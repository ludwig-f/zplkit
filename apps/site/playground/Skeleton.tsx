import type { ReactNode } from "react";
import "./styles.css";
import "./bench.css";

/** Widths of the code lines shown while loading, in characters */
const lines = [58, 0, 22, 34, 46, 40, 0, 30, 52, 44, 26, 0, 36, 60, 48, 18];

/**
 * The playground's or viewer's layout while its code loads: the same
 * toolbar, panes and platen, with disabled controls and placeholder lines,
 * so nothing moves when the real page takes its place
 */
export default function Skeleton({
  file,
  tabs,
  toolbar,
}: {
  file: string;
  tabs: string[];
  /** The page's toolbar controls, disabled */
  toolbar: ReactNode;
}) {
  return (
    <div className="playground skeleton" data-tab={tabs[0]} aria-busy="true">
      <div className="toolbar">
        <span className="filename">{file}</span>
        <span className="divider" aria-hidden="true" />
        {toolbar}
      </div>

      <div className="tabs" aria-hidden="true">
        {tabs.map((tab, index) => (
          <button key={tab} type="button" disabled aria-selected={index === 0}>
            {tab}
          </button>
        ))}
      </div>

      <div className="workspace">
        <section className="code" aria-label="Loading the editor">
          <div className="skeleton-lines" aria-hidden="true">
            {lines.map((width, index) => (
              <div key={index} className="skeleton-line">
                <span className="skeleton-number">{index + 1}</span>
                {width > 0 && (
                  <span
                    className="skeleton-bar"
                    style={{ width: `${width}ch` }}
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="preview" aria-label="Loading the preview">
          <div className="status">
            <span className="busy">Loading…</span>
          </div>
          <div className="bench-area">
            <div className="bench">
              <div className="liner skeleton-liner" aria-hidden="true">
                <div className="skeleton-frame">
                  <div className="skeleton-paper" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
