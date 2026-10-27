import { describe, test, expect } from "vitest";
import { connectUsbPrinter } from "./usb.js";
import { fakeUsbPrinter } from "./fakes.test-utils.js";

describe("connectUsbPrinter", () => {
  test("opens the device and claims the printer interface", async () => {
    const fake = fakeUsbPrinter();
    await connectUsbPrinter(fake.device);
    expect(fake.device.opened).toBe(true);
    expect(fake.claimed).toStrictEqual([1]);
  });

  test("sends ZPL to the bulk out endpoint", async () => {
    const fake = fakeUsbPrinter();
    const printer = await connectUsbPrinter(fake.device);
    await printer.send("^XA^XZ");
    expect(fake.written).toStrictEqual(["^XA^XZ"]);
  });

  test("reads the status", async () => {
    const fake = fakeUsbPrinter({ answers: true });
    const printer = await connectUsbPrinter(fake.device);
    expect(await printer.status()).toMatchObject({ ready: true });
  });

  test("keeps one read pending when the printer doesn't answer", async () => {
    const fake = fakeUsbPrinter();
    const printer = await connectUsbPrinter(fake.device);
    expect(await printer.status({ timeout: 30 })).toMatchObject({
      noReply: true,
    });
    expect(await printer.status({ timeout: 30 })).toMatchObject({
      noReply: true,
    });
    expect(fake.transfersIn()).toBe(1);
  });

  test("closes the device", async () => {
    const fake = fakeUsbPrinter();
    const printer = await connectUsbPrinter(fake.device);
    await printer.close();
    expect(fake.device.closed).toBe(true);
  });

  test("needs WebUSB to pick a printer", async () => {
    await expect(connectUsbPrinter()).rejects.toThrow(/WebUSB/);
  });
});
