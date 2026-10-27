// @vitest-environment node
import { test, expect } from "vitest";

test("importing without a DOM, e.g. during server rendering, doesn't throw", async () => {
  await expect(import("./index.js")).resolves.toHaveProperty("ZplPreview");
});
