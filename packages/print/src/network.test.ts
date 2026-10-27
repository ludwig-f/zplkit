// A local TCP server stands in for a network printer
import { describe, test, expect, afterEach } from "vitest";
import { createServer } from "node:net";
import type { Server, Socket } from "node:net";
import { connectNetworkPrinter } from "./network.js";

const ready =
  "\x02030,0,0,1218,000,0,0,0,000,0,0,0\x03\r\n" +
  "\x02000,0,0,0,0,2,0,0,00000000,1,000\x03\r\n" +
  "\x021234,0\x03\r\n";

let server: Server | undefined;

/** A fake printer that records what it receives and answers ~HS as told */
const fakePrinter = async (answer?: (socket: Socket) => void) => {
  const received: string[] = [];
  server = createServer((socket) => {
    socket.on("data", (chunk) => {
      received.push(chunk.toString());
      if (chunk.toString().includes("~HS")) answer?.(socket);
    });
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  return { port, received };
};

afterEach(async () => {
  if (server) await new Promise((resolve) => server!.close(resolve));
  server = undefined;
});

describe("connectNetworkPrinter", () => {
  test("sends ZPL as UTF-8", async () => {
    const fake = await fakePrinter();
    const printer = await connectNetworkPrinter("127.0.0.1", {
      port: fake.port,
    });
    await printer.send("^XA^FDHäj^FS^XZ");
    await printer.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.received.join("")).toBe("^XA^FDHäj^FS^XZ");
  });

  test("sends anything with toZPL()", async () => {
    const fake = await fakePrinter();
    const printer = await connectNetworkPrinter("127.0.0.1", {
      port: fake.port,
    });
    await printer.send({ toZPL: () => "^XA^XZ" });
    await printer.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.received.join("")).toBe("^XA^XZ");
  });

  test("reads the status", async () => {
    const fake = await fakePrinter((socket) => socket.write(ready));
    const printer = await connectNetworkPrinter("127.0.0.1", {
      port: fake.port,
    });
    expect(await printer.status()).toMatchObject({
      ready: true,
      labelLength: 1218,
    });
    await printer.close();
  });

  test("reads a status that arrives in pieces", async () => {
    const fake = await fakePrinter((socket) => {
      socket.write(ready.slice(0, 20));
      setTimeout(() => socket.write(ready.slice(20)), 20);
    });
    const printer = await connectNetworkPrinter("127.0.0.1", {
      port: fake.port,
    });
    expect(await printer.status()).toMatchObject({ ready: true });
    await printer.close();
  });

  test("a printer that doesn't answer has no reply", async () => {
    const fake = await fakePrinter();
    const printer = await connectNetworkPrinter("127.0.0.1", {
      port: fake.port,
    });
    expect(await printer.status({ timeout: 100 })).toStrictEqual({
      ready: false,
      noReply: true,
    });
    await printer.close();
  });

  test("rejects when nothing listens", async () => {
    // Port 1 is outside the range the system picks client ports from. A
    // port a fake printer just let go of is inside it, and the connection
    // can be given that same port as its own and connect to itself.
    await expect(
      connectNetworkPrinter("127.0.0.1", { port: 1 })
    ).rejects.toThrow();
  });
});
