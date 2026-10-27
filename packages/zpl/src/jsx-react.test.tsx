/** @jsxImportSource react */
// Labels written in a React project, compiled by React's own JSX runtime
import { suite, test, expect } from "vitest";
import { Label, Text, Box, Code128, build } from "./jsx.js";
import ZplError from "./ZplError.js";
import { dots, mm } from "./units.js";
import type { Length } from "./units.js";

const Header = (props: { x: Length; title: string }) => (
  <Text x={props.x} y={dots(0)} height={mm(5)}>
    {props.title}
  </Text>
);

suite("jsx with React's runtime", () => {
  test("builds the same ZPL as zplkit's own runtime", () => {
    const lines = ["One", "Two"];
    const express = false;

    const label = build(
      <Label width={mm(57)} height={mm(19)} dpmm={12}>
        <Header x={dots(10)} title="Harbor Parts" />
        <>
          {lines.map((line, i) => (
            <Text key={line} x={dots(10)} y={dots(80 + i * 40)}>
              {line}
            </Text>
          ))}
        </>
        {express && (
          <Text x={dots(0)} y={dots(0)}>
            EXPRESS
          </Text>
        )}
        <Box
          x={dots(0)}
          y={dots(0)}
          width={mm(10)}
          height={mm(5)}
          thickness={dots(2)}
        />
        <Code128 x={dots(10)} y={dots(200)} height={mm(8)}>
          ABC-{123}
        </Code128>
      </Label>
    );

    expect(label.toZPL()).toStrictEqual(
      "^XA^PW684^LL228^LRN^CI28^LH0,0" +
        "^FO10,0^A0,60^FDHarbor Parts^FS" +
        "^FO10,80^FDOne^FS^FO10,120^FDTwo^FS" +
        "^FO0,0^GB120,60,2,B,0^FS" +
        "^FO10,200^BC,96^FDABC-123^FS^XZ"
    );
  });

  test("rejects HTML elements inside a label", () => {
    expect(() =>
      build(
        <Label width={mm(57)} height={mm(19)} dpmm={12}>
          <div />
        </Label>
      )
    ).toThrow(new ZplError("<div> can't be used in a label"));
  });

  test("throws when the root is not a <Label>", () => {
    expect(() =>
      build(
        <Text x={dots(0)} y={dots(0)}>
          Hi
        </Text>
      )
    ).toThrow(ZplError);
  });
});
