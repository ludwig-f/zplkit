/**
 * Bluetooth LE printers from the browser, with Web Bluetooth (Chrome and
 * Edge), through Zebra's Bluetooth LE Parser Service. Not yet tested on a
 * real printer: see the README.
 *
 * Bluetooth LE is slow; Zebra measured about 80 bytes per second, so it
 * suits text labels better than images.
 */
import { Printer } from "./printer.js";
import type { Connection } from "./printer.js";

/** Zebra's Bluetooth LE Parser Service and its characteristics */
const PARSER_SERVICE = "38eb4a80-c570-11e3-9507-0002a5d5c51b";
const FROM_PRINTER = "38eb4a81-c570-11e3-9507-0002a5d5c51b";
const TO_PRINTER = "38eb4a82-c570-11e3-9507-0002a5d5c51b";

/** The parts of Web Bluetooth used here */
type BluetoothCharacteristic = {
  writeValueWithResponse(value: Uint8Array): Promise<void>;
  startNotifications(): Promise<unknown>;
  addEventListener(
    type: "characteristicvaluechanged",
    listener: (event: { target: { value?: DataView } }) => void
  ): void;
};

type BluetoothDevice = {
  gatt?: {
    connected: boolean;
    connect(): Promise<{
      getPrimaryService(uuid: string): Promise<{
        getCharacteristic(uuid: string): Promise<BluetoothCharacteristic>;
      }>;
    }>;
    disconnect(): void;
  };
};

type BluetoothNavigator = {
  bluetooth?: {
    requestDevice(options: {
      filters: { services: string[] }[];
    }): Promise<BluetoothDevice>;
  };
};

type BluetoothOptions = {
  /**
   * Bytes per write. Every connection takes 20; larger chunks are faster
   * when the connection allows them, up to 512.
   * @defaultValue 20
   */
  chunkSize?: number;
};

/**
 * Connect to a printer over Bluetooth LE. Without a device, asks the person
 * to pick one; call it from a click or other user action, as Web Bluetooth
 * requires.
 */
const connectBluetoothPrinter = async (
  device?: BluetoothDevice,
  options: BluetoothOptions = {}
): Promise<Printer> => {
  let chosen = device;
  if (!chosen) {
    const bluetooth = (globalThis.navigator as BluetoothNavigator | undefined)
      ?.bluetooth;
    if (!bluetooth)
      throw new Error("This browser doesn't support Web Bluetooth");
    chosen = await bluetooth.requestDevice({
      filters: [{ services: [PARSER_SERVICE] }],
    });
  }
  if (!chosen.gatt) throw new Error("This Bluetooth device has no GATT server");

  const server = await chosen.gatt.connect();
  const service = await server.getPrimaryService(PARSER_SERVICE);
  const toPrinter = await service.getCharacteristic(TO_PRINTER);
  const fromPrinter = await service.getCharacteristic(FROM_PRINTER);

  // Replies arrive as indications, queued until they're read
  const received: Uint8Array[] = [];
  let waiting: ((chunk: Uint8Array) => void) | undefined;
  fromPrinter.addEventListener("characteristicvaluechanged", (event) => {
    const value = event.target.value;
    if (!value) return;
    const bytes = new Uint8Array(
      value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
    );
    if (waiting) {
      waiting(bytes);
      waiting = undefined;
    } else {
      received.push(bytes);
    }
  });
  await fromPrinter.startNotifications();

  const chunkSize = Math.min(512, Math.max(1, options.chunkSize ?? 20));
  const gatt = chosen.gatt;
  const connection: Connection = {
    write: async (data) => {
      for (let i = 0; i < data.length; i += chunkSize) {
        await toPrinter.writeValueWithResponse(data.subarray(i, i + chunkSize));
      }
    },
    read: (timeout) => {
      const queued = received.shift();
      if (queued) return Promise.resolve(queued);
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          waiting = undefined;
          resolve(undefined);
        }, timeout);
        waiting = (chunk) => {
          clearTimeout(timer);
          resolve(chunk);
        };
      });
    },
    close: async () => gatt.disconnect(),
  };
  return new Printer(connection);
};

export { connectBluetoothPrinter, PARSER_SERVICE };
export type { BluetoothDevice, BluetoothOptions };
