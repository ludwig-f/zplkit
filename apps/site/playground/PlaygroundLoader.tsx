"use client";

import dynamic from "next/dynamic";
import Skeleton from "./Skeleton";

/** The playground needs the DOM (CodeMirror, <zpl-preview>), so it renders in the browser only */
const Playground = dynamic(() => import("./Playground"), {
  ssr: false,
  loading: () => (
    <Skeleton
      file="label.tsx"
      tabs={["Code", "Preview", "Problems (0)"]}
      toolbar={
        <>
          <label className="toggle">
            <input type="checkbox" defaultChecked disabled />
            Smooth edges
          </label>
          <div className="spacer" />
          <select aria-label="Open an example" disabled>
            <option>Examples</option>
          </select>
          <button type="button" disabled>
            Fonts
          </button>
          <button type="button" disabled>
            Share link
          </button>
          <button type="button" disabled>
            Copy ZPL
          </button>
          <button type="button" className="primary" disabled>
            Download PNG
          </button>
        </>
      }
    />
  ),
});

export default function PlaygroundLoader() {
  return <Playground />;
}
