"use client";

import dynamic from "next/dynamic";
import Skeleton from "./Skeleton";

/** The viewer needs the DOM (CodeMirror, <zpl-preview>), so it renders in the browser only */
const Viewer = dynamic(() => import("./Viewer"), {
  ssr: false,
  loading: () => (
    <Skeleton
      file="label.zpl"
      tabs={["Editor", "Preview", "Problems (0)"]}
      toolbar={
        <>
          <label className="field">
            Size
            <select disabled>
              <option>From ^PW and ^LL</option>
            </select>
          </label>
          <div className="segmented" aria-hidden="true">
            {[152, 203, 300, 600].map((dpi) => (
              <button key={dpi} type="button" disabled>
                {dpi}
              </button>
            ))}
          </div>
          <span className="unit">dpi</span>
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
            Show as code
          </button>
          <button type="button" disabled>
            Share link
          </button>
          <button type="button" className="primary" disabled>
            Download PNG
          </button>
        </>
      }
    />
  ),
});

export default function ViewerLoader() {
  return <Viewer />;
}
