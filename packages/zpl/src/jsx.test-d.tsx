import { test } from "vitest";
import { Label, Text, Box } from "./jsx.js";
import { dots, mm } from "./units.js";

test("lengths in JSX props require an explicit unit", () => {
  <Label width={mm(57)} height={mm(19)} dpmm={8}>
    {/* @ts-expect-error - bare numbers are ambiguous */}
    <Box x={5} y={dots(5)} width={mm(10)} height={mm(5)} thickness={dots(2)} />
  </Label>;
});

test("text must be wrapped in <Text>", () => {
  // @ts-expect-error - loose text is not a label element
  <Label width={mm(57)} height={mm(19)} dpmm={8}>
    Hello
  </Label>;
});

test("<Text> needs content", () => {
  // @ts-expect-error - children are required
  <Text x={dots(0)} y={dots(0)} />;
});

test("dpmm must be a real printer resolution", () => {
  // @ts-expect-error - no 10 dpmm printers
  <Label width={mm(57)} height={mm(19)} dpmm={10} />;
});
