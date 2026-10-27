import { isCompleteHostStatus, parseHostStatus } from "./status.js";
import type { PrinterStatus } from "./status.js";

/**
 * A connection to a printer: network, USB, Bluetooth or your own. Printers
 * only need write(); read() lets them answer status requests.
 */
type Connection = {
  /** Send bytes to the printer */
  write(data: Uint8Array): Promise<void>;
  /**
   * The next bytes the printer sent, or undefined when nothing arrives
   * within `timeout` milliseconds. Leave it out for one-way connections.
   */
  read?(timeout: number): Promise<Uint8Array | undefined>;
  /** Close the connection */
  close(): Promise<void>;
};

/** ZPL text, or anything with toZPL(), like a Label or PrintJob */
type ZplSource = string | { toZPL(): string };

/** What status() returns when the printer doesn't answer */
type NoReply = {
  ready: false;
  /**
   * The printer didn't answer ~HS in time. Printers don't answer while
   * they're out of media or ribbon, the head is open, the rewinder is full
   * or the head is too hot, so this usually means one of those.
   */
  noReply: true;
};

type StatusOptions = {
  /**
   * How long to wait for the reply, in milliseconds
   * @defaultValue 2000
   */
  timeout?: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * A printer on a connection. Send it labels with send(), and ask how it's
 * doing with status() when the connection can read.
 */
class Printer {
  readonly #connection: Connection;

  constructor(connection: Connection) {
    this.#connection = connection;
  }

  /** Send ZPL to the printer. ZPL is sent as UTF-8, which ^CI28 expects. */
  async send(zpl: ZplSource): Promise<void> {
    const text = typeof zpl === "string" ? zpl : zpl.toZPL();
    await this.#connection.write(encoder.encode(text));
  }

  /**
   * Ask the printer for its status with ~HS. Resolves with `noReply` when
   * it doesn't answer in time; see NoReply for why that happens.
   */
  async status(options: StatusOptions = {}): Promise<PrinterStatus | NoReply> {
    const read = this.#connection.read?.bind(this.#connection);
    if (!read) {
      throw new Error("This connection can't read the printer's replies");
    }
    const deadline = Date.now() + (options.timeout ?? 2000);
    await this.#connection.write(encoder.encode("~HS"));

    let reply = "";
    while (!isCompleteHostStatus(reply)) {
      const left = deadline - Date.now();
      if (left <= 0) return { ready: false, noReply: true };
      const chunk = await read(left);
      if (!chunk) return { ready: false, noReply: true };
      reply += decoder.decode(chunk, { stream: true });
    }
    return parseHostStatus(reply);
  }

  /** Close the connection */
  close(): Promise<void> {
    return this.#connection.close();
  }
}

export { Printer };
export type { Connection, NoReply, StatusOptions, ZplSource };
