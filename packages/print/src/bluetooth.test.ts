import { describe, test, expect } from "vitest";
import { connectBluetoothPrinter } from "./bluetooth.js";
import { fakeBluetoothPrinter } from "./fakes.test-utils.js";

describe("connectBluetoothPrinter", () => {
  test("writes ZPL in 20 byte chunks", async () => {
    const fake = fakeBluetoothPrinter();
    const printer = await connectBluetoothPrinter(fake.device);
    const zpl = "^XA^FO50,50^A0N,40,40^FDHello Bluetooth^FS^XZ";
    await printer.send(zpl);
    expect(fake.text()).toBe(zpl);
    expect(Math.max(...fake.writes)).toBe(20);
  });

  test("writes larger chunks when asked", async () => {
    const fake = fakeBluetoothPrinter();
    const printer = await connectBluetoothPrinter(fake.device, {
      chunkSize: 100,
    });
    await printer.send("x".repeat(250));
    expect(fake.writes).toStrictEqual([100, 100, 50]);
  });

  test("reads the status from indications", async () => {
    const fake = fakeBluetoothPrinter();
    const printer = await connectBluetoothPrinter(fake.device);
    expect(await printer.status()).toMatchObject({
      ready: true,
      labelLength: 1218,
    });
  });

  test("disconnects on close", async () => {
    const fake = fakeBluetoothPrinter();
    const printer = await connectBluetoothPrinter(fake.device);
    await printer.close();
    expect(fake.connected()).toBe(false);
  });

  test("needs Web Bluetooth to pick a printer", async () => {
    await expect(connectBluetoothPrinter()).rejects.toThrow(/Web Bluetooth/);
  });
});
