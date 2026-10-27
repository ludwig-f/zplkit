import { test, expect } from "vitest";
import { parsedCommands } from "../../zpl/src/parse.js";
import { renderedCommands } from "./support.js";

test("every command drawn is one the parser reads", () => {
  expect(
    renderedCommands.filter((code) => !parsedCommands.includes(code))
  ).toStrictEqual([]);
});
