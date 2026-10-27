/**
 * USB printers from the browser, with WebUSB (Chrome and Edge). Not yet
 * tested on a real printer: see the README.
 *
 * On Windows the system's printer driver usually claims the printer first,
 * so WebUSB can't open it; macOS, Linux, ChromeOS and Android work.
 */
import { Printer } from "./printer.js";
import type { Connection } from "./printer.js";

/** Zebra's USB vendor ID */
const ZEBRA_VENDOR_ID = 0x0a5f;
/** The USB printer interface class */
const PRINTER_CLASS = 0x07;

/** The parts of WebUSB's USBDevice used here */
type UsbDevice = {
  opened: boolean;
  configuration: UsbConfiguration | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(value: number): Promise<void>;
  claimInterface(number: number): Promise<void>;
  transferOut(
    endpoint: number,
    data: Uint8Array
  ): Promise<{ status: string; bytesWritten: number }>;
  transferIn(
    endpoint: number,
    length: number
  ): Promise<{ status: string; data?: DataView }>;
};

type UsbConfiguration = {
  interfaces: {
    interfaceNumber: number;
    alternate: {
      interfaceClass: number;
      endpoints: {
        endpointNumber: number;
        direction: "in" | "out";
        type: string;
      }[];
    };
  }[];
};

type UsbNavigator = {
  usb?: {
    requestDevice(options: {
      filters: { vendorId?: number; classCode?: number }[];
    }): Promise<UsbDevice>;
  };
};

/** The printer interface and its bulk endpoints */
const findEndpoints = (configuration: UsbConfiguration) => {
  const interfaces = [...configuration.interfaces].sort(
    (a, b) =>
      Number(b.alternate.interfaceClass === PRINTER_CLASS) -
      Number(a.alternate.interfaceClass === PRINTER_CLASS)
  );
  for (const { interfaceNumber, alternate } of interfaces) {
    const bulk = alternate.endpoints.filter((e) => e.type === "bulk");
    const out = bulk.find((e) => e.direction === "out");
    if (out) {
      const input = bulk.find((e) => e.direction === "in");
      return {
        interfaceNumber,
        out: out.endpointNumber,
        in: input?.endpointNumber,
      };
    }
  }
  throw new Error("This USB device has no endpoint to send data to");
};

/** A connection over a USB device that's been opened and claimed */
const usbConnection = async (device: UsbDevice): Promise<Connection> => {
  if (!device.opened) await device.open();
  if (!device.configuration) await device.selectConfiguration(1);
  const endpoints = findEndpoints(device.configuration!);
  await device.claimInterface(endpoints.interfaceNumber);

  // WebUSB reads can't be cancelled, so one that times out stays pending
  // and the next read picks it up
  let pending: Promise<Uint8Array | undefined> | undefined;
  const transfer = () =>
    device
      .transferIn(endpoints.in!, 512)
      .then((result) =>
        result.data && result.data.byteLength > 0
          ? new Uint8Array(
              result.data.buffer,
              result.data.byteOffset,
              result.data.byteLength
            )
          : undefined
      );

  return {
    write: async (data) => {
      const result = await device.transferOut(endpoints.out, data);
      if (result.status !== "ok") {
        throw new Error(`The printer didn't take the data (${result.status})`);
      }
    },
    read:
      endpoints.in === undefined
        ? undefined
        : (timeout) => {
            pending ??= transfer();
            const current = pending;
            return Promise.race([
              current.then((data) => {
                pending = undefined;
                return data;
              }),
              new Promise<undefined>((resolve) => setTimeout(resolve, timeout)),
            ]);
          },
    close: () => device.close(),
  };
};

/**
 * Connect to a USB printer. Without a device, asks the person to pick a
 * Zebra printer; call it from a click or other user action, as WebUSB
 * requires.
 *
 * ```ts
 * button.onclick = async () => {
 *   const printer = await connectUsbPrinter();
 *   await printer.send(label);
 * };
 * ```
 */
const connectUsbPrinter = async (device?: UsbDevice): Promise<Printer> => {
  let chosen = device;
  if (!chosen) {
    const usb = (globalThis.navigator as UsbNavigator | undefined)?.usb;
    if (!usb) throw new Error("This browser doesn't support WebUSB");
    chosen = await usb.requestDevice({
      filters: [{ vendorId: ZEBRA_VENDOR_ID }, { classCode: PRINTER_CLASS }],
    });
  }
  return new Printer(await usbConnection(chosen));
};

export { connectUsbPrinter, ZEBRA_VENDOR_ID };
export type { UsbDevice };
