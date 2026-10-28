import { describe, test, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./server.js";
import type { ServerOptions } from "./server.js";

/** A client talking to a new server */
const connect = async (options?: ServerOptions) => {
  const server = createServer(options);
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(clientSide);
  return client;
};

type Content = {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
};

/** Call a tool and return its content */
const call = async (
  client: Client,
  name: string,
  args: Record<string, unknown>
) => {
  const result = await client.callTool({ name, arguments: args });
  return {
    content: result.content as Content[],
    text: (result.content as Content[])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n"),
    isError: result.isError ?? false,
  };
};

const label = "^XA^PW406^LL203^FO20,20^A0N,40^FDHi^FS^XZ";

describe("tools", () => {
  test("render, lint, convert, look up and link, and print only when allowed", async () => {
    const names = async (options?: ServerOptions) =>
      (await (await connect(options)).listTools()).tools.map((t) => t.name);
    expect(await names()).toEqual([
      "render_zpl",
      "lint_zpl",
      "convert_zpl",
      "lookup_command",
      "viewer_link",
    ]);
    expect(await names({ allowPrint: true })).toContain("print_zpl");
  });
});

describe("render_zpl", () => {
  test("returns the label as a PNG, with its size", async () => {
    const { content, text } = await call(await connect(), "render_zpl", {
      zpl: label,
    });
    const images = content.filter((c) => c.type === "image");
    expect(images).toHaveLength(1);
    expect(images[0].mimeType).toBe("image/png");
    expect(
      Buffer.from(images[0].data!, "base64").subarray(1, 4).toString()
    ).toBe("PNG");
    expect(text).toContain("1 label, 406 × 203 dots at 203 dpi");
  });

  test("shows the first labels of many, and says how many there are", async () => {
    const serial = "^XA^PW406^LL203^FO20,20^A0N,40^SN001,1,Y^FS^PQ5^XZ";
    const { content, text } = await call(await connect(), "render_zpl", {
      zpl: serial,
    });
    expect(content.filter((c) => c.type === "image")).toHaveLength(3);
    expect(text).toContain("the first 3 of 5 different labels");
  });

  test("says what isn't drawn, and what lint found", async () => {
    const { text } = await call(await connect(), "render_zpl", {
      zpl: "^XA^PW406^LL203^PMY^FO20,20^B4N,20^FDAB^FS^XZ",
    });
    expect(text).toContain("^B4 isn't drawn yet");
    expect(text).toContain("lint_zpl found 1 warning");
  });

  test("takes a size and resolution", async () => {
    const { text } = await call(await connect(), "render_zpl", {
      zpl: "^XA^FO20,20^A0N,40^FDHi^FS^XZ",
      dpi: 300,
      width: "2in",
      height: "1in",
    });
    expect(text).toContain("600 × 300 dots at 300 dpi");
  });

  test("reports ZPL without labels as an error", async () => {
    const result = await call(await connect(), "render_zpl", { zpl: "hello" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("No labels");
  });
});

describe("lint_zpl", () => {
  test("lists problems with their line and column", async () => {
    const { text } = await call(await connect(), "lint_zpl", {
      zpl: "^XA\n^PMY^FO20,20^FDHi^FS\n^XZ",
    });
    expect(text).toBe(
      "2:1 warning setting-kept-after-label: ^PM stays on for the labels printed after this one, also from other software, until it's set again. Set it once with PrinterSetup.setMirror() instead."
    );
  });

  test("says when there's nothing to fix", async () => {
    expect((await call(await connect(), "lint_zpl", { zpl: label })).text).toBe(
      "No problems found."
    );
  });
});

describe("convert_zpl", () => {
  test("writes zplkit code", async () => {
    const client = await connect();
    expect((await call(client, "convert_zpl", { zpl: label })).text).toContain(
      "build("
    );
    expect(
      (await call(client, "convert_zpl", { zpl: label, style: "builder" })).text
    ).toContain("new Label(");
  });
});

describe("lookup_command", () => {
  test("describes a command, with or without its prefix", async () => {
    const client = await connect();
    const { text } = await call(client, "lookup_command", { command: "^FO" });
    expect(text).toContain("^FO Field Origin");
    expect(text).toContain("Format: ^FOx,y,z");
    expect(text).toContain("https://zplkit.fingal.dev/docs/commands/FO");
    expect((await call(client, "lookup_command", { command: "fo" })).text).toBe(
      text
    );
  });

  test("says how zplkit supports it", async () => {
    const { text } = await call(await connect(), "lookup_command", {
      command: "^SF",
    });
    expect(text).toContain("Partly supported by zplkit");
  });

  test("suggests commands for one it doesn't know", async () => {
    const result = await call(await connect(), "lookup_command", {
      command: "^FZ",
    });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("There's no ^FZ command");
    expect(result.text).toContain("^FO");
  });
});

describe("viewer_link", () => {
  test("links to the viewer with the ZPL in the link", async () => {
    const { text } = await call(await connect(), "viewer_link", { zpl: label });
    expect(text).toMatch(/^https:\/\/zplkit\.fingal\.dev\/viewer#[\w-]+$/);
  });
});

describe("print_zpl", () => {
  test("sends to the printer when it's ready", async () => {
    const sent: string[] = [];
    const client = await connect({
      allowPrint: true,
      connect: async () => ({
        send: async (zpl) => {
          sent.push(zpl);
        },
        status: async () => ({ ready: true }),
        close: async () => {},
      }),
    });
    const { text } = await call(client, "print_zpl", {
      zpl: label,
      printer: "192.168.1.50",
    });
    expect(sent).toEqual([label]);
    expect(text).toBe("Sent to 192.168.1.50");
  });

  test("sends nothing when the printer isn't ready", async () => {
    const sent: string[] = [];
    const client = await connect({
      allowPrint: true,
      connect: async () => ({
        send: async (zpl) => {
          sent.push(zpl);
        },
        status: async () => ({ ready: false, paperOut: true }),
        close: async () => {},
      }),
    });
    const result = await call(client, "print_zpl", {
      zpl: label,
      printer: "192.168.1.50",
    });
    expect(sent).toEqual([]);
    expect(result.isError).toBe(true);
    expect(result.text).toBe(
      "192.168.1.50 isn't ready: out of labels. Nothing was sent."
    );
  });
});
