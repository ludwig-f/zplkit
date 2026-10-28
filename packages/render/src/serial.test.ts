// Values measured from reference renders of ^SN and ^SF with ^PQ
import { describe, test, expect } from "vitest";
import { serialNumber, serializedField } from "./serial.js";

/** The values of the first `count` copies */
const copies = (count: number, value: (step: number) => string) =>
  Array.from({ length: count }, (_, step) => value(step));

describe("serialNumber", () => {
  test("counts by the increment, keeping leading zeros with Y", () => {
    expect(copies(3, (step) => serialNumber("001", 1, true, step))).toEqual([
      "001",
      "002",
      "003",
    ]);
    expect(copies(3, (step) => serialNumber("5", 2, false, step))).toEqual([
      "5",
      "7",
      "9",
    ]);
  });

  test("prints leading zeros as spaces with N, but not the last digit", () => {
    expect(copies(3, (step) => serialNumber("009", 1, false, step))).toEqual([
      "  9",
      " 10",
      " 11",
    ]);
    expect(serialNumber("000", 1, false, 0)).toBe("  0");
    expect(copies(3, (step) => serialNumber("100", -1, false, step))).toEqual([
      "100",
      " 99",
      " 98",
    ]);
  });

  test("wraps around within its width, then keeps the zeros", () => {
    expect(copies(4, (step) => serialNumber("998", 1, false, step))).toEqual([
      "998",
      "999",
      "000",
      "001",
    ]);
    expect(copies(5, (step) => serialNumber("010", -3, true, step))).toEqual([
      "010",
      "007",
      "004",
      "001",
      "998",
    ]);
  });

  test("counts only the last run of digits", () => {
    expect(copies(3, (step) => serialNumber("AB09", 1, true, step))).toEqual([
      "AB09",
      "AB10",
      "AB11",
    ]);
    expect(copies(2, (step) => serialNumber("A9Z9", 1, true, step))).toEqual([
      "A9Z9",
      "A9Z0",
    ]);
    expect(copies(2, (step) => serialNumber("AB009", 1, false, step))).toEqual([
      "AB  9",
      "AB 10",
    ]);
  });

  test("starts at 1 without a value", () => {
    expect(
      copies(2, (step) => serialNumber(undefined, 1, false, step))
    ).toEqual(["1", "2"]);
  });
});

describe("serializedField", () => {
  test("lines the mask up with the start of the data", () => {
    expect(
      copies(3, (step) => serializedField("AB0099", "%%dddd", "1", step))
    ).toEqual(["AB0099", "AB0100", "AB0101"]);
  });

  test("lines the increment up with the end of the mask", () => {
    expect(
      copies(3, (step) => serializedField("AB0099", "dddd", "1", step))
    ).toEqual(["AB0099", "AB0199", "AB0299"]);
    expect(
      copies(3, (step) => serializedField("AB0099", "dddd", "10", step))
    ).toEqual(["AB0099", "AB1099", "AB2099"]);
  });

  test("drops the carry at a character that isn't a digit", () => {
    expect(
      copies(3, (step) => serializedField("X99", "ddd", "1", step))
    ).toEqual(["X99", "X00", "X01"]);
    expect(
      copies(2, (step) => serializedField("AB0099", "dddd", "1000", step))
    ).toEqual(["AB0099", "AB0099"]);
  });

  test("counts down, wrapping around", () => {
    expect(
      copies(3, (step) => serializedField("0001", "dddd", "-1", step))
    ).toEqual(["0001", "0000", "9999"]);
  });

  test("counts in octal and hex", () => {
    expect(copies(3, (step) => serializedField("07", "oo", "1", step))).toEqual(
      ["07", "10", "11"]
    );
    expect(copies(2, (step) => serializedField("0F", "HH", "1", step))).toEqual(
      ["0F", "10"]
    );
  });

  test("counts letters with A and letters after digits with N", () => {
    expect(copies(3, (step) => serializedField("AY", "AA", "B", step))).toEqual(
      ["AY", "AZ", "BA"]
    );
    expect(copies(3, (step) => serializedField("AY", "AA", "C", step))).toEqual(
      ["AY", "BA", "BC"]
    );
    expect(copies(4, (step) => serializedField("A9", "NN", "1", step))).toEqual(
      ["A9", "AA", "AB", "AC"]
    );
    expect(copies(3, (step) => serializedField("0Z", "NN", "1", step))).toEqual(
      ["0Z", "10", "11"]
    );
    expect(copies(6, (step) => serializedField("X", "A", "B", step))).toEqual([
      "X",
      "Y",
      "Z",
      "A",
      "B",
      "C",
    ]);
    expect(copies(3, (step) => serializedField("B", "A", "-B", step))).toEqual([
      "B",
      "A",
      "Z",
    ]);
  });

  test("reads the increment in each position's digits", () => {
    // A counts from A, so 1 isn't a digit there and adds nothing
    expect(copies(2, (step) => serializedField("AZ", "AA", "1", step))).toEqual(
      ["AZ", "AZ"]
    );
    expect(copies(3, (step) => serializedField("A0", "AN", "1", step))).toEqual(
      ["A0", "A1", "A2"]
    );
    expect(copies(2, (step) => serializedField("0Y", "NN", "b", step))).toEqual(
      ["0Y", "0Y"]
    );
  });

  test("carries between different masks", () => {
    expect(
      copies(3, (step) => serializedField("AZ9", "dAd", "1", step))
    ).toEqual(["AZ9", "AA0", "AA1"]);
    expect(copies(3, (step) => serializedField("Ay", "Aa", "b", step))).toEqual(
      ["Ay", "Az", "Ba"]
    );
  });

  test("takes the case of letters from the mask", () => {
    expect(copies(2, (step) => serializedField("09", "hh", "1", step))).toEqual(
      ["09", "0a"]
    );
    expect(copies(2, (step) => serializedField("09", "HH", "1", step))).toEqual(
      ["09", "0A"]
    );
    expect(copies(3, (step) => serializedField("0z", "nn", "1", step))).toEqual(
      ["0z", "10", "11"]
    );
    // A letter in the other case isn't a digit, so nothing counts
    expect(copies(2, (step) => serializedField("0F", "hh", "1", step))).toEqual(
      ["0F", "0F"]
    );
    expect(copies(2, (step) => serializedField("ay", "AA", "B", step))).toEqual(
      ["ay", "ay"]
    );
  });

  test("counts by 1 without an increment", () => {
    expect(serializedField("0099", "dddd", undefined, 2)).toBe("0101");
  });
});
