"use client";

import dynamic from "next/dynamic";
import Skeleton from "./Skeleton";

/** The viewer needs the DOM (CodeMirror, <zpl-preview>), so it renders in the browser only */
const Viewer = dynamic(() => import("./Viewer"), {
  ssr: false,
  loading: () => (
    <Skeleton
      tool="viewer"
      tabs={["Editor", "Preview", "Problems (0)"]}
      toolbar={
        <>
          <label className="field">
            <span className="field-label">Size</span>
            <select disabled>
              <option>4 × 6 in</option>
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
        </>
      }
    />
  ),
});

export default function ViewerLoader() {
  return <Viewer />;
}
