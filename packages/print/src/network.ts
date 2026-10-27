/**
 * Network printers, which take ZPL on TCP port 9100. Node only, since
 * browsers can't open TCP connections.
 */
import { connect } from "node:net";
import type { Socket } from "node:net";
import { Printer } from "./printer.js";
import type { Connection } from "./printer.js";

type NetworkOptions = {
  /**
   * The printer's raw port
   * @defaultValue 9100
   */
  port?: number;
  /**
   * How long to wait for the connection, in milliseconds
   * @defaultValue 5000
   */
  timeout?: number;
};

/** A TCP connection, with what the printer sends queued until it's read */
const socketConnection = (socket: Socket): Connection => {
  const received: Uint8Array[] = [];
  let waiting: ((chunk: Uint8Array | undefined) => void) | undefined;
  socket.on("data", (chunk: Buffer) => {
    const bytes = new Uint8Array(chunk);
    if (waiting) {
      waiting(bytes);
      waiting = undefined;
    } else {
      received.push(bytes);
    }
  });

  return {
    write: (data) =>
      new Promise((resolve, reject) =>
        socket.write(data, (error) => (error ? reject(error) : resolve()))
      ),
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
    close: () =>
      new Promise((resolve) => {
        socket.end(() => resolve());
      }),
  };
};

/**
 * Connect to a network printer, by IP address or host name.
 *
 * ```ts
 * const printer = await connectNetworkPrinter("192.168.1.50");
 * await printer.send(label);
 * await printer.close();
 * ```
 */
const connectNetworkPrinter = (
  host: string,
  options: NetworkOptions = {}
): Promise<Printer> =>
  new Promise((resolve, reject) => {
    const socket = connect({ host, port: options.port ?? 9100 });
    socket.setTimeout(options.timeout ?? 5000, () => {
      socket.destroy();
      reject(new Error(`No answer from ${host} within the timeout`));
    });
    socket.once("error", reject);
    socket.once("connect", () => {
      // The connect timeout is done; reads have their own
      socket.setTimeout(0);
      socket.off("error", reject);
      resolve(new Printer(socketConnection(socket)));
    });
  });

export { connectNetworkPrinter };
export type { NetworkOptions };
