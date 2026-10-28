import { describe, expect, test } from "vitest";
import { designFor } from "./fields";
import {
  captionOf,
  captionSide,
  cropsFor,
  describeSelection,
  extentOf,
  guideName,
  handlesFor,
  positionIn,
  problemKeys,
  tagOf,
} from "./overlay";

const options = { widthMm: 50, heightMm: 25, dpmm: 8 };

const fieldsOf = (zpl: string) => {
  const design = designFor(zpl, options);
  return { design, fields: design.labels[0].fields };
};

describe("tagOf", () => {
  test("names the kind and the line the field starts on", () => {
    const { design, fields } = fieldsOf(
      "^XA\n^FO10,10^GB100,50,3^FS\n^FO10,80^A0N,30^FDHi^FS\n^XZ"
    );
    expect(tagOf(design, fields[0])).toBe("Box · L2");
    expect(tagOf(design, fields[1])).toBe("Text · L3");
  });

  test("names barcodes by their symbology", () => {
    const { design, fields } = fieldsOf(
      "^XA\n^FO10,10^BCN,50^FD123^FS\n^FO200,10^BQN,2,3^FDQA,1^FS\n^XZ"
    );
    expect(tagOf(design, fields[0])).toBe("Code 128 · L2");
    expect(tagOf(design, fields[1])).toBe("QR code · L3");
  });

  test("says how many labels share a field from a stored format", () => {
    const zpl =
      "^XA^DFR:A.ZPL^FS^FO10,10^A0N,30^FN1^FS^XZ\n" +
      "^XA^XFR:A.ZPL^FN1^FDOne^FS^XZ\n" +
      "^XA^XFR:A.ZPL^FN1^FDTwo^FS^XZ\n";
    const design = designFor(zpl, options);
    const field = design.labels[0].fields[0];
    expect(tagOf(design, field)).toBe("Shared by 2 labels");
  });

  test("says copies when the labels are copies of one", () => {
    const zpl = "^XA^FO10,10^A0N,30^SN001,1^FS^PQ3^XZ";
    const design = designFor(zpl, options);
    expect(design.labels).toHaveLength(3);
    expect(tagOf(design, design.labels[1].fields[0])).toBe(
      "Shared by 3 copies"
    );
  });
});

describe("tagOf past the labels shown", () => {
  test("counts every copy, not only the ones designed", () => {
    const zpl = "^XA^FO10,10^A0N,30^SN001,1^FS^PQ6^XZ";
    const design = designFor(zpl, { ...options, limit: 5 });
    expect(design.labels).toHaveLength(5);
    expect(tagOf(design, design.labels[0].fields[0])).toBe(
      "Shared by 6 copies"
    );
  });

  test("counts every label recalling the format", () => {
    const recalls = Array.from(
      { length: 7 },
      (_, i) => `^XA^XFR:A.ZPL^FN1^FD${i}^FS^XZ\n`
    ).join("");
    const zpl = "^XA^DFR:A.ZPL^FS^FO10,10^A0N,30^FN1^FS^XZ\n" + recalls;
    const design = designFor(zpl, { ...options, limit: 5 });
    expect(tagOf(design, design.labels[0].fields[0])).toBe(
      "Shared by 7 labels"
    );
  });

  test("counts copies of each recalling label", () => {
    const zpl =
      "^XA^DFR:A.ZPL^FS^FO10,10^A0N,30^SN1,1^FS^XZ\n" +
      "^XA^XFR:A.ZPL^PQ2^XZ\n^XA^XFR:A.ZPL^PQ3^XZ\n";
    const design = designFor(zpl, options);
    expect(tagOf(design, design.labels[0].fields[0])).toBe(
      "Shared by 5 labels"
    );
  });
});

describe("cropsFor", () => {
  const zpl = "^XA^FO10,10^GB100,50,50^FS^FO200,100^GB50,50,50^FS^XZ";

  test("a move shifts every selected field on the label", () => {
    const { design, fields } = fieldsOf(zpl);
    const keys = fields.map((f) => f.key);
    expect(cropsFor(design, 0, keys, "move", { dx: 5, dy: -5 })).toEqual([
      { from: fields[0].bounds, to: { ...fields[0].bounds, x: 15, y: 5 } },
      { from: fields[1].bounds, to: { ...fields[1].bounds, x: 205, y: 95 } },
    ]);
  });

  test("a resize stretches the field to the step's bounds", () => {
    const { design, fields } = fieldsOf(zpl);
    const bounds = { x: 10, y: 10, width: 120, height: 60 };
    expect(
      cropsFor(design, 0, [fields[0].key], "resize", { dx: 0, dy: 0, bounds })
    ).toEqual([{ from: fields[0].bounds, to: bounds }]);
  });

  test("leaves out fields with no ink", () => {
    const { design, fields } = fieldsOf("^XA^FO30,40^A0N,30^FD^FS^XZ");
    expect(
      cropsFor(design, 0, [fields[0].key], "move", { dx: 1, dy: 1 })
    ).toEqual([]);
  });
});

describe("captionOf", () => {
  test("names the command of a field that isn't drawn", () => {
    const { design, fields } = fieldsOf("^XA^FO10,10^B4N,20^FD12^FS^XZ");
    expect(fields[0].drawn).toBe(false);
    expect(captionOf(design, fields[0])).toBe("^B4 · not drawn");
  });

  test("is empty for drawn fields", () => {
    const { design, fields } = fieldsOf("^XA^FO10,10^GB100,50,3^FS^XZ");
    expect(captionOf(design, fields[0])).toBe("");
  });
});

describe("problemKeys", () => {
  test("maps problems to the fields their start is in", () => {
    const zpl = "^XA^FO10,10^GB100,50,3^FS^FO10,80^A0N,30^FDHi^FS^XZ";
    const { design, fields } = fieldsOf(zpl);
    const at = zpl.indexOf("^A0");
    expect(problemKeys(design, [{ from: at }])).toEqual(
      new Set([fields[1].key])
    );
    // Outside every field
    expect(problemKeys(design, [{ from: 0 }])).toEqual(new Set());
  });
});

describe("handlesFor", () => {
  test("a field with no size has none", () => {
    const { design, fields } = fieldsOf("^XA^FO10,10^A0N,30^FD^FS^XZ");
    expect(fields[0].bounds).toMatchObject({ width: 0, height: 0 });
    expect(handlesFor(design, fields[0])).toEqual([]);
  });

  test("boxes get eight handles", () => {
    const { design, fields } = fieldsOf("^XA^FO10,10^GB100,50,3^FS^XZ");
    expect(handlesFor(design, fields[0])).toHaveLength(8);
  });

  test("text and QR codes keep their shape: four corners", () => {
    const { design, fields } = fieldsOf(
      "^XA^FO10,10^A0N,30,30^FDHi^FS^FO200,10^BQN,2,3^FDQA,1^FS^XZ"
    );
    expect(handlesFor(design, fields[0])).toEqual(["nw", "ne", "sw", "se"]);
    expect(handlesFor(design, fields[1])).toEqual(["nw", "ne", "sw", "se"]);
  });

  test("Code 128 changes its height: top and bottom, or the sides when turned", () => {
    const { design, fields } = fieldsOf(
      "^XA^FO10,10^BCN,50^FD123^FS^FO200,10^BCR,50^FD123^FS^XZ"
    );
    expect(handlesFor(design, fields[0])).toEqual(["n", "s"]);
    expect(handlesFor(design, fields[1])).toEqual(["w", "e"]);
  });

  test("fields without a size get none", () => {
    const { design, fields } = fieldsOf("^XA^FO10,10^A0N^FDHi^FS^XZ");
    expect(handlesFor(design, fields[0])).toEqual([]);
  });
});

describe("guideName", () => {
  const label = { width: 400, height: 200 };
  const others = [{ x: 50, y: 20, width: 100, height: 40 }];

  test("names the label's edges and center", () => {
    expect(guideName({ axis: "x", at: 0 }, label, others)).toBe("label edge");
    expect(guideName({ axis: "y", at: 200 }, label, others)).toBe("label edge");
    expect(guideName({ axis: "x", at: 200 }, label, others)).toBe(
      "label center"
    );
  });

  test("names other fields' edges and centers", () => {
    expect(guideName({ axis: "x", at: 150 }, label, others)).toBe("field edge");
    expect(guideName({ axis: "y", at: 40 }, label, others)).toBe(
      "field center"
    );
  });
});

describe("positionIn", () => {
  test("shows the ^FO a move writes in the chosen unit", () => {
    const { design, fields } = fieldsOf("^XA^FO10,10^GB100,50,3^FS^XZ");
    expect(positionIn(design, fields[0], "^FO351,648", "mm")).toBe(
      "43.9, 81.0 mm"
    );
    expect(positionIn(design, fields[0], "^FO351,648", "dots")).toBe(
      "351, 648 dots"
    );
  });

  test("reads the ^FO in ^MU units", () => {
    const { design, fields } = fieldsOf("^XA^MUM^FO10,10^GB10,5,1^FS^XZ");
    expect(positionIn(design, fields[0], "^FO12.5,20", "dots")).toBe(
      "100, 160 dots"
    );
  });

  test("is empty without a position", () => {
    const { design, fields } = fieldsOf("^XA^FO10,10^GB100,50,3^FS^XZ");
    expect(positionIn(design, fields[0], "^GB120,50,3", "mm")).toBe("");
  });
});

describe("describeSelection", () => {
  test("says what's selected, for the overlay's label", () => {
    const { design, fields } = fieldsOf(
      "^XA\n^FO10,10^GB100,50,3^FS\n^FO10,80^A0N,30^FDHi^FS\n^XZ"
    );
    expect(describeSelection(design, { keys: [], label: 0 })).toBe(
      "Label designer, nothing selected"
    );
    expect(describeSelection(design, { keys: [fields[1].key], label: 0 })).toBe(
      "Label designer, Text on line 3 selected"
    );
    expect(
      describeSelection(design, {
        keys: fields.map((f) => f.key),
        label: 0,
      })
    ).toBe("Label designer, 2 fields selected");
  });
});

describe("extentOf", () => {
  test("is the selected fields' bounds together", () => {
    const { design, fields } = fieldsOf(
      "^XA^FO10,10^GB100,50,50^FS^FO200,100^GB50,50,50^FS^XZ"
    );
    expect(
      extentOf(design, { keys: fields.map((f) => f.key), label: 0 })
    ).toEqual({ label: 0, x: 10, y: 10, width: 240, height: 140 });
    expect(extentOf(design, { keys: [], label: 0 })).toBeUndefined();
  });
});

describe("captionSide", () => {
  test("above the field, like the tag", () => {
    expect(captionSide({ top: 100, labelTop: 0, selected: false })).toBe(
      "above"
    );
  });

  test("below when there's no room above the label's top", () => {
    expect(captionSide({ top: 10, labelTop: 0, selected: false })).toBe(
      "below"
    );
  });

  test("below when the tag of a selected field is above", () => {
    expect(captionSide({ top: 100, labelTop: 0, selected: true })).toBe(
      "below"
    );
  });
});
