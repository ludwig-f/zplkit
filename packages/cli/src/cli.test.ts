import { describe, test, expect } from "vitest";
import { inflateRawSync } from "node:zlib";
import { run } from "./cli.js";
import type { Io } from "./cli.js";

/** An io with files in memory, a fake browser and a fake printer */
const fakeIo = (files: Record<string, string> = {}, stdin = "") => {
  const written = new Map<string, Uint8Array>();
  const out: string[] = [];
  const err: string[] = [];
  const opened: string[] = [];
  const sent: { host: string; port: number; zpl: string[] }[] = [];
  let status: unknown = { ready: true };
  const io: Io = {
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
    readFile: async (path) => {
      if (!(path in files)) throw new Error(`ENOENT: no such file, '${path}'`);
      return files[path];
    },
    readStdin: async () => stdin,
    writeFile: async (path, data) => {
      written.set(path, data);
    },
    open: async (url) => {
      opened.push(url);
    },
    connect: async (host, port) => {
      const connection = { host, port, zpl: [] as string[] };
      sent.push(connection);
      return {
        send: async (zpl: string) => {
          connection.zpl.push(zpl);
        },
        status: async () => status,
        close: async () => {},
      };
    },
  };
  return {
    io,
    written,
    out,
    err,
    opened,
    sent,
    setStatus: (value: unknown) => (status = value),
  };
};

/** Width and height of a PNG, from its header */
const pngSize = (png: Uint8Array) => {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

const label = "^XA^PW406^LL203^FO20,20^A0N,40^FDHi^FS^XZ";

describe("render", () => {
  test("writes a PNG next to the file, sized from ^PW and ^LL", async () => {
    const fake = fakeIo({ "label.zpl": label });
    expect(await run(["render", "label.zpl"], fake.io)).toBe(0);
    const png = fake.written.get("label.png")!;
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(pngSize(png)).toEqual({ width: 406, height: 203 });
    expect(fake.out).toEqual(["label.png"]);
  });

  test("takes a size and resolution", async () => {
    const fake = fakeIo({ "label.zpl": label });
    await run(
      [
        "render",
        "label.zpl",
        "-o",
        "out.png",
        "--width",
        "2in",
        "--height",
        "25mm",
        "--dpi",
        "300",
      ],
      fake.io
    );
    expect(pngSize(fake.written.get("out.png")!)).toEqual({
      width: 600,
      height: 300,
    });
  });

  test("numbers each different label, and counts identical copies", async () => {
    const serial = "^XA^PW406^LL203^FO20,20^A0N,40^SN001,1,Y^FS^PQ3^XZ";
    const fake = fakeIo({ "box.zpl": serial });
    await run(["render", "box.zpl"], fake.io);
    expect([...fake.written.keys()]).toEqual([
      "box-1.png",
      "box-2.png",
      "box-3.png",
    ]);

    const same = fakeIo({ "same.zpl": label.replace("^XZ", "^PQ3^XZ") });
    await run(["render", "same.zpl"], same.io);
    expect([...same.written.keys()]).toEqual(["same.png"]);
    expect(same.out).toEqual(["same.png (prints 3 times)"]);
  });

  test("reads standard input", async () => {
    const fake = fakeIo({}, label);
    expect(await run(["render", "-", "-o", "label.png"], fake.io)).toBe(0);
    expect(fake.written.has("label.png")).toBe(true);
  });

  test("fills in ^FC dates from --clock", async () => {
    const fake = fakeIo({
      "a.zpl": "^XA^PW406^LL203^FO20,20^A0N,40^FC%^FD%Y^FS^XZ",
      "b.zpl": "^XA^PW406^LL203^FO20,20^A0N,40^FD2026^FS^XZ",
    });
    await run(["render", "a.zpl", "--clock", "2026-10-28T08:00"], fake.io);
    await run(["render", "b.zpl"], fake.io);
    expect(fake.written.get("a.png")).toEqual(fake.written.get("b.png"));
  });
});

describe("lint", () => {
  test("lists problems with their line and column", async () => {
    const fake = fakeIo({
      "label.zpl": "^XA\n^PMY^FO20,20^FDHi^FS\n^XZ",
    });
    expect(await run(["lint", "label.zpl"], fake.io)).toBe(0);
    expect(fake.out).toEqual([
      "label.zpl:2:1  warning  ^PM stays on for the labels printed after this one, also from other software, until it's set again. Set it once with PrinterSetup.setMirror() instead.  setting-kept-after-label",
    ]);
  });

  test("fails on errors, and on warnings with --strict", async () => {
    const fake = fakeIo({
      "open.zpl": "^XA^FO20,20^FDHi^XZ",
      "warn.zpl": "^XA^PMY^FO20,20^FDHi^FS^XZ",
    });
    expect(await run(["lint", "open.zpl"], fake.io)).toBe(1);
    expect(await run(["lint", "warn.zpl", "--strict"], fake.io)).toBe(1);
  });

  test("says when there's nothing to fix", async () => {
    const fake = fakeIo({ "label.zpl": label });
    expect(await run(["lint", "label.zpl"], fake.io)).toBe(0);
    expect(fake.out).toEqual(["label.zpl: no problems"]);
  });
});

describe("convert", () => {
  test("writes JSX, or builder calls with --style builder", async () => {
    const fake = fakeIo({ "label.zpl": label });
    await run(["convert", "label.zpl"], fake.io);
    expect(fake.out.join("\n")).toContain("build(");
    await run(["convert", "label.zpl", "--style", "builder"], fake.io);
    expect(fake.out.join("\n")).toContain("new Label(");
  });
});

describe("view", () => {
  test("opens the label in the viewer, with the ZPL in the link", async () => {
    const fake = fakeIo({ "label.zpl": label });
    expect(await run(["view", "label.zpl", "--dpi", "300"], fake.io)).toBe(0);
    const [link] = fake.out;
    expect(link.startsWith("https://zplkit.fingal.dev/viewer#")).toBe(true);
    expect(fake.opened).toEqual([link]);
    const hash = link.split("#")[1].replace(/-/g, "+").replace(/_/g, "/");
    const state = JSON.parse(
      inflateRawSync(Buffer.from(hash, "base64")).toString()
    );
    expect(state).toEqual([label, null, null, 12, 0.4]);
  });

  test("only prints the link with --no-open", async () => {
    const fake = fakeIo({ "label.zpl": label });
    await run(["view", "label.zpl", "--no-open"], fake.io);
    expect(fake.opened).toEqual([]);
  });
});

describe("print", () => {
  test("sends the ZPL to a network printer", async () => {
    const fake = fakeIo({ "label.zpl": label });
    expect(
      await run(["print", "label.zpl", "--printer", "192.168.1.50"], fake.io)
    ).toBe(0);
    expect(fake.sent).toEqual([
      { host: "192.168.1.50", port: 9100, zpl: [label] },
    ]);
    expect(fake.out).toEqual(["Sent label.zpl to 192.168.1.50"]);
  });

  test("takes a port, and stops when the printer isn't ready", async () => {
    const fake = fakeIo({ "label.zpl": label });
    fake.setStatus({ ready: false, paperOut: true, headOpen: false });
    expect(
      await run(
        ["print", "label.zpl", "--printer", "printer.local:6101"],
        fake.io
      )
    ).toBe(1);
    expect(fake.sent[0]).toMatchObject({
      host: "printer.local",
      port: 6101,
      zpl: [],
    });
    expect(fake.err).toEqual([
      "printer.local isn't ready: out of labels. Nothing was sent.",
    ]);
  });

  test("needs a printer", async () => {
    const fake = fakeIo({ "label.zpl": label });
    expect(await run(["print", "label.zpl"], fake.io)).toBe(2);
    expect(fake.err[0]).toContain("--printer");
  });
});

describe("status", () => {
  test("says whether the printer is ready, and why not", async () => {
    const fake = fakeIo();
    expect(await run(["status", "--printer", "10.0.0.5"], fake.io)).toBe(0);
    expect(fake.out).toEqual(["10.0.0.5 is ready"]);

    fake.setStatus({ ready: false, noReply: true });
    expect(await run(["status", "--printer", "10.0.0.5"], fake.io)).toBe(1);
    expect(fake.out.at(-1)).toBe(
      "10.0.0.5 didn't answer: it may be out of labels or ribbon, open, or paused"
    );
  });
});

describe("usage", () => {
  test("lists the commands, and fails on unknown ones", async () => {
    const fake = fakeIo();
    expect(await run(["--help"], fake.io)).toBe(0);
    expect(fake.out.join("\n")).toContain("zplkit render");
    expect(await run(["frobnicate"], fake.io)).toBe(2);
    expect(fake.err.join("\n")).toContain("Unknown command 'frobnicate'");
  });

  test("says which file it couldn't read", async () => {
    const fake = fakeIo();
    expect(await run(["render", "missing.zpl"], fake.io)).toBe(1);
    expect(fake.err).toEqual(["Can't read missing.zpl"]);
  });
});
