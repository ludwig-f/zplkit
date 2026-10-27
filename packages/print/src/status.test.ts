// Replies laid out as in Zebra's ZPL II Programming Guide for ~HS
import { describe, test, expect } from "vitest";
import { parseHostStatus } from "./status.js";

/** A ~HS reply from its three strings */
const reply = (first: string, second: string, third = "1234,0") =>
  `\x02${first}\x03\r\n\x02${second}\x03\r\n\x02${third}\x03\r\n`;

describe("parseHostStatus", () => {
  test("a printer that's ready", () => {
    const status = parseHostStatus(
      reply(
        "030,0,0,1218,000,0,0,0,000,0,0,0",
        "000,0,0,0,0,2,0,0,00000000,1,003"
      )
    );
    expect(status).toMatchObject({
      ready: true,
      paperOut: false,
      paused: false,
      headOpen: false,
      printMode: "tear-off",
      labelLength: 1218,
      formatsInBuffer: 0,
      graphicsStored: 3,
    });
  });

  test("paper out and paused", () => {
    const status = parseHostStatus(
      reply(
        "030,1,1,1218,002,0,0,0,000,0,0,0",
        "000,0,0,0,1,0,0,0,00000005,1,000"
      )
    );
    expect(status).toMatchObject({
      ready: false,
      paperOut: true,
      paused: true,
      formatsInBuffer: 2,
      labelsRemaining: 5,
      thermalTransfer: true,
      printMode: "rewind",
    });
  });

  test("head open and ribbon out", () => {
    const status = parseHostStatus(
      reply(
        "030,0,0,1218,000,0,0,0,000,0,0,0",
        "000,0,1,1,1,3,0,0,00000000,1,000"
      )
    );
    expect(status).toMatchObject({
      ready: false,
      headOpen: true,
      ribbonOut: true,
      printMode: "cutter",
    });
  });

  test("throws for something that isn't a ~HS reply", () => {
    expect(() => parseHostStatus("hello")).toThrow(/~HS/);
  });
});
