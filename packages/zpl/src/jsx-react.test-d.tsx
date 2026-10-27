/** @jsxImportSource react */
import { test } from "vitest";
import { Label, Text, Box, build } from "./jsx.js";
import { dots, mm } from "./units.js";

test("label elements type-check under React's JSX types", () => {
  build(
    <Label width={mm(57)} height={mm(19)} dpmm={8}>
      <Text x={dots(0)} y={dots(0)}>
        Hi {1}
      </Text>
      {false && (
        <Box
          x={dots(0)}
          y={dots(0)}
          width={mm(1)}
          height={mm(1)}
          thickness={dots(1)}
        />
      )}
    </Label>
  );
});

test("prop types still apply under React's JSX types", () => {
  const element = (
    // @ts-expect-error - bare numbers are ambiguous
    <Text x={5} y={dots(0)}>
      Hi
    </Text>
  );
  void element;
});
