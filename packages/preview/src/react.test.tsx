import { test, expect } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { configure } from "./index.js";
import "./react.js";

// Echo what the element was asked to render instead of rendering it
configure({
  render: async (zpl, options) => [
    btoa(`${zpl}|${options.dpmm}|${options.grayscale}`),
  ],
});

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

test("React sets props as properties and listens to the element's events", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const label = { toZPL: () => "^XA^XZ" };
  let images: string[] = [];

  await act(async () => {
    createRoot(container).render(
      <zpl-preview
        zpl={label}
        dpmm={12}
        smoothing={0}
        onzpl-render={(event) => {
          images = event.detail.images;
        }}
      />
    );
  });
  await act(() => new Promise((resolve) => setTimeout(resolve, 10)));

  const element = container.querySelector("zpl-preview")!;
  expect(element.zpl).toBe(label);
  expect(element.dpmm).toBe(12);
  expect(images).toStrictEqual([
    `data:image/png;base64,${btoa("^XA^XZ|12|false")}`,
  ]);
});
