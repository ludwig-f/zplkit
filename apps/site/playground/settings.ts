"use client";

import { useEffect, useState } from "react";

/** The unit the rulers, the cursor position and custom sizes are shown in */
type Unit = "mm" | "in" | "dots";

/**
 * How the playground and the viewer show labels, shared by both and saved
 * in this browser. They change what's shown, never the label or its ZPL.
 */
type Settings = {
  unit: Unit;
  /** Edge smoothing for the preview; 0 shows the printer's exact dots */
  smoothing: number;
};

const STORAGE_KEY = "zplkit-settings";

/** Smoothing when "Smooth edges" is on */
const SMOOTHING = 0.4;

const defaults: Settings = { unit: "mm", smoothing: SMOOTHING };

const load = (): Settings => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return {
      unit: ["mm", "in", "dots"].includes(saved.unit)
        ? saved.unit
        : defaults.unit,
      smoothing:
        typeof saved.smoothing === "number"
          ? saved.smoothing
          : defaults.smoothing,
    };
  } catch {
    // Storage can be unavailable, e.g. in private windows
    return defaults;
  }
};

/** The settings, and a way to change them */
const useSettings = () => {
  // Defaults on the first render, so it matches the server's; the saved
  // settings load right after
  const [settings, setSettings] = useState<Settings>(defaults);

  useEffect(() => setSettings(load()), []);

  const update = (changes: Partial<Settings>) =>
    setSettings((current) => {
      const next = { ...current, ...changes };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Kept for this visit only
      }
      return next;
    });

  return { ...settings, update };
};

export { useSettings, SMOOTHING };
export type { Settings, Unit };
