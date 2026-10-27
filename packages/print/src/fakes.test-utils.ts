// Fake WebUSB and Web Bluetooth devices, shaped like the browser APIs
import type { UsbDevice } from "./usb.js";
import type { BluetoothDevice } from "./bluetooth.js";

export const hostStatus =
  "\x02030,0,0,1218,000,0,0,0,000,0,0,0\x03\r\n" +
  "\x02000,0,0,0,0,2,0,0,00000000,1,000\x03\r\n" +
  "\x021234,0\x03\r\n";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

/** A USB printer that answers ~HS when `answers` is set */
export const fakeUsbPrinter = (options: { answers?: boolean } = {}) => {
  const written: string[] = [];
  const claimed: number[] = [];
  let transfersIn = 0;
  let reply: ((data: Uint8Array) => void) | undefined;
  const device: UsbDevice & { closed: boolean } = {
    opened: false,
    closed: false,
    configuration: null,
    open: async () => {
      device.opened = true;
    },
    close: async () => {
      device.closed = true;
    },
    selectConfiguration: async () => {
      device.configuration = {
        interfaces: [
          {
            interfaceNumber: 0,
            alternate: { interfaceClass: 0xff, endpoints: [] },
          },
          {
            interfaceNumber: 1,
            alternate: {
              interfaceClass: 0x07,
              endpoints: [
                { endpointNumber: 1, direction: "out", type: "bulk" },
                { endpointNumber: 2, direction: "in", type: "bulk" },
              ],
            },
          },
        ],
      };
    },
    claimInterface: async (number) => {
      claimed.push(number);
    },
    transferOut: async (_endpoint, data) => {
      const text = decoder.decode(data);
      written.push(text);
      if (text === "~HS" && options.answers) {
        setTimeout(() => reply?.(encoder.encode(hostStatus)), 10);
      }
      return { status: "ok", bytesWritten: data.length };
    },
    transferIn: () => {
      transfersIn++;
      return new Promise((resolve) => {
        reply = (data) =>
          resolve({ status: "ok", data: new DataView(data.buffer) });
      });
    },
  };
  return { device, written, claimed, transfersIn: () => transfersIn };
};

/** A Bluetooth LE printer whose replies arrive as indications */
export const fakeBluetoothPrinter = () => {
  const writes: number[] = [];
  let text = "";
  let listener: ((event: { target: { value?: DataView } }) => void) | undefined;
  const indicate = (chunk: string) =>
    listener?.({
      target: { value: new DataView(encoder.encode(chunk).buffer) },
    });
  let connected = false;
  const device: BluetoothDevice = {
    gatt: {
      get connected() {
        return connected;
      },
      connect: async () => {
        connected = true;
        return {
          getPrimaryService: async () => ({
            getCharacteristic: async (uuid: string) => ({
              writeValueWithResponse: async (value: Uint8Array) => {
                writes.push(value.length);
                text += decoder.decode(value);
                if (text.endsWith("~HS")) {
                  // Replies come back a few bytes at a time
                  setTimeout(() => {
                    for (let i = 0; i < hostStatus.length; i += 20) {
                      indicate(hostStatus.slice(i, i + 20));
                    }
                  }, 10);
                }
              },
              startNotifications: async () => {
                if (!uuid.startsWith("38eb4a81")) {
                  throw new Error("Only From Printer Data indicates");
                }
              },
              addEventListener: (_type: string, callback: typeof listener) => {
                if (uuid.startsWith("38eb4a81")) listener = callback;
              },
            }),
          }),
        };
      },
      disconnect: () => {
        connected = false;
      },
    },
  };
  return { device, writes, text: () => text, connected: () => connected };
};
