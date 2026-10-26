"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Font files the visitor adds, kept in this browser's IndexedDB so the viewer
 * and the playground share them and they survive a reload. They're never
 * uploaded anywhere.
 */
type StoredFont = {
  /** "font0" for font 0, or a printer path like "E:ARIAL.TTF" */
  key: string;
  /** The file's name, to show which file it is */
  fileName: string;
  bytes: Uint8Array;
};

const DATABASE = "zplkit-fonts";
const STORE = "fonts";
const FONT0 = "font0";

const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transaction = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const database = await open();
  return new Promise((resolve, reject) => {
    const request = run(database.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/** Whether bytes start like a TrueType, OpenType or TrueType collection */
const isFontFile = (bytes: Uint8Array) => {
  const tag = String.fromCharCode(...bytes.slice(0, 4));
  return (
    tag === "\0\u0001\0\0" || tag === "OTTO" || tag === "true" || tag === "ttcf"
  );
};

/** The printer path for a file, like E:ARIAL.TTF for arial.ttf */
const defaultPath = (fileName: string) =>
  `E:${fileName.toUpperCase().replace(/\s+/g, "")}`;

/** A path as the label calls it: a device letter, a colon and a name */
const isPrinterPath = (path: string) => /^[A-Z]:[^:\s]+\.[A-Z]{3}$/.test(path);

/** Fonts the visitor added, and ways to change them */
const useFonts = () => {
  const [stored, setStored] = useState<StoredFont[]>([]);

  const reload = async () => {
    try {
      setStored(await transaction("readonly", (store) => store.getAll()));
    } catch {
      // IndexedDB can be unavailable, e.g. in some private windows
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const save = async (font: StoredFont) => {
    try {
      await transaction("readwrite", (store) => store.put(font));
    } catch {
      // Not saved, but still used until the page is closed
    }
    setStored((current) => [
      ...current.filter((other) => other.key !== font.key),
      font,
    ]);
  };

  const remove = async (key: string) => {
    try {
      await transaction("readwrite", (store) => store.delete(key));
    } catch {
      // Removed from the page either way
    }
    setStored((current) => current.filter((font) => font.key !== key));
  };

  const font0 = stored.find((font) => font.key === FONT0);
  const printerFonts = stored.filter((font) => font.key !== FONT0);
  // Kept stable so the preview only renders again when fonts change
  const fonts = useMemo(() => {
    const entries = stored
      .filter((font) => font.key !== FONT0)
      .map((font) => [font.key, font.bytes] as const);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }, [stored]);

  return { font0, printerFonts, fonts, save, remove };
};

type Fonts = ReturnType<typeof useFonts>;

export { useFonts, isFontFile, defaultPath, isPrinterPath, FONT0 };
export type { StoredFont, Fonts };
