import { test } from "vitest";
import "./react.js";

test("<zpl-preview> props are typed in React", () => {
  <zpl-preview
    zpl="^XA^XZ"
    width={50.8}
    dpmm={8}
    className="preview"
    onzpl-error={(event) => event.detail.error.message}
  />;

  // @ts-expect-error - dpmm is a number
  <zpl-preview dpmm="8" />;
});
