import { test, expect } from "vitest";
import { countLabels } from "@zplkit/render";
import { analyze } from "./analyze";
import examples from "./examples";

const clean = examples.filter((example) => example.name !== "Common mistakes");

test.each(clean.map((example) => [example.name, example]))(
  "%s prints without problems",
  (_name, example) => {
    expect(analyze(example.zpl, { dpmm: example.dpmm })).toStrictEqual([]);
  }
);

test("numbered boxes print 6 different labels", () => {
  const boxes = examples.find((example) => example.name === "Numbered boxes")!;
  expect(countLabels(boxes.zpl)).toEqual({ labels: 6, printed: 6 });
});
