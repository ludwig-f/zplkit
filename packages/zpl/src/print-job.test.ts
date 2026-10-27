import { describe, test, expect } from "vitest";
import Label from "./Label.js";
import PrinterSetup from "./PrinterSetup.js";
import PrintJob from "./PrintJob.js";
import { dots, mm } from "./units.js";

const label = (text: string) =>
  new Label({ width: mm(10), height: mm(10), dpmm: 12 }).text({
    position: { x: dots(0), y: dots(0) },
    text,
  });

describe("PrintJob", () => {
  test("joins setup and labels in order", () => {
    const setup = new PrinterSetup().setDarkness(20);
    const job = new PrintJob(setup, label("A"), label("B"));
    expect(job.toZPL()).toBe(
      setup.toZPL() + label("A").toZPL() + label("B").toZPL()
    );
  });

  test("add() appends parts and chains", () => {
    const job = new PrintJob().add(label("A")).add(label("B"), label("C"));
    expect(job.parts).toHaveLength(3);
    expect(job.toZPL()).toBe(
      label("A").toZPL() + label("B").toZPL() + label("C").toZPL()
    );
  });

  test("an empty job is empty ZPL", () => {
    expect(new PrintJob().toZPL()).toBe("");
  });

  test("puts each part on its own line when not minified", () => {
    const setup = new PrinterSetup().setDarkness(20);
    const job = new PrintJob({ minify: false }, setup, label("A"));
    expect(job.toZPL()).toBe(setup.toZPL() + "\n" + label("A").toZPL());
  });

  test("lint checks the whole job", () => {
    const job = new PrintJob(
      new PrinterSetup().setDarkness(20),
      label("A").raw("~JA")
    );
    expect(job.lint().map((problem) => problem.rule)).toStrictEqual([
      "printer-command-in-label",
    ]);
    expect(new PrintJob(new PrinterSetup(), label("A")).lint()).toStrictEqual(
      []
    );
  });
});
