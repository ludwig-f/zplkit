/**
 * The printer's reply to ~HS (host status), as Zebra's ZPL II Programming
 * Guide describes it: three strings, each between STX and ETX.
 */

/** How the printer hands labels over, from ~HS */
type PrintMode =
  | "rewind"
  | "peel-off"
  | "tear-off"
  | "cutter"
  | "applicator"
  | "delayed-cut"
  | "linerless-peel"
  | "linerless-rewind"
  | "partial-cutter"
  | "rfid"
  | "kiosk"
  | "unknown";

/** What the printer reports about itself */
type PrinterStatus = {
  /** True when nothing stops the printer from printing */
  ready: boolean;
  /** Out of labels */
  paperOut: boolean;
  /** Paused, for example from the PAUSE button or ^PP */
  paused: boolean;
  /** The printhead is open */
  headOpen: boolean;
  /** Out of ribbon, in thermal transfer mode */
  ribbonOut: boolean;
  /** The receive buffer is full */
  bufferFull: boolean;
  /** The head is too cold to print well */
  underTemperature: boolean;
  /** The head is too hot */
  overTemperature: boolean;
  /** Configuration data was lost */
  corruptRam: boolean;
  /** A label is waiting to be taken, in peel-off mode */
  labelWaiting: boolean;
  /** Thermal transfer (with ribbon) rather than direct thermal */
  thermalTransfer: boolean;
  printMode: PrintMode;
  /** The label length the printer uses, in dots */
  labelLength: number;
  /** Formats received but not printed yet */
  formatsInBuffer: number;
  /** Labels left to print in the current batch */
  labelsRemaining: number;
  /** Graphics stored on the printer */
  graphicsStored: number;
};

const printModes: Record<string, PrintMode> = {
  "0": "rewind",
  "1": "peel-off",
  "2": "tear-off",
  "3": "cutter",
  "4": "applicator",
  "5": "delayed-cut",
  "6": "linerless-peel",
  "7": "linerless-rewind",
  "8": "partial-cutter",
  "9": "rfid",
  K: "kiosk",
};

const STX = "\x02";
const ETX = "\x03";

/** The strings between STX and ETX in a reply */
const replyStrings = (reply: string): string[] => {
  const strings: string[] = [];
  let start = reply.indexOf(STX);
  while (start >= 0) {
    const end = reply.indexOf(ETX, start);
    if (end < 0) break;
    strings.push(reply.slice(start + 1, end));
    start = reply.indexOf(STX, end);
  }
  return strings;
};

/** True when a reply to ~HS has all three of its strings */
const isCompleteHostStatus = (reply: string): boolean =>
  replyStrings(reply).length >= 3;

/**
 * Read a printer's reply to ~HS. Throws if the reply doesn't have the three
 * strings Zebra's guide describes.
 */
const parseHostStatus = (reply: string): PrinterStatus => {
  const [first, second] = replyStrings(reply).map((string) =>
    string.split(",")
  );
  if (!first || !second || first.length < 12 || second.length < 11) {
    throw new Error("Not a reply to ~HS: expected three status strings");
  }
  const flag = (value: string | undefined) => value?.trim() === "1";
  const number = (value: string | undefined) => Number(value?.trim() ?? 0);

  const status = {
    paperOut: flag(first[1]),
    paused: flag(first[2]),
    labelLength: number(first[3]),
    formatsInBuffer: number(first[4]),
    bufferFull: flag(first[5]),
    corruptRam: flag(first[9]),
    underTemperature: flag(first[10]),
    overTemperature: flag(first[11]),
    headOpen: flag(second[2]),
    ribbonOut: flag(second[3]),
    thermalTransfer: flag(second[4]),
    printMode: printModes[second[5]?.trim() ?? ""] ?? "unknown",
    labelWaiting: flag(second[7]),
    labelsRemaining: number(second[8]),
    graphicsStored: number(second[10]),
  };
  return {
    ready:
      !status.paperOut &&
      !status.paused &&
      !status.headOpen &&
      !status.ribbonOut &&
      !status.bufferFull &&
      !status.overTemperature,
    ...status,
  };
};

export type { PrinterStatus, PrintMode };
export { parseHostStatus, isCompleteHostStatus };
