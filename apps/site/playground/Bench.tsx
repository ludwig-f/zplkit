"use client";

import { useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import "./bench.css";

/** Screen pixels per millimeter at most, so small labels aren't blown up */
const MAX_PX_PER_MM = 6;

/** Width of the vertical ruler, which the horizontal one starts after */
const RULER_PX = 32;

/** A position on a label, in dots from its top-left corner */
type Cursor = { x: number; y: number; label: number };

type BenchProps = {
  widthMm: number;
  heightMm: number;
  /** Called with the position under the pointer, or undefined when it leaves */
  onCursor?: (cursor: Cursor | undefined) => void;
  /** Called when a label is clicked, with the position clicked */
  onPick?: (cursor: Cursor) => void;
  /**
   * How many labels are shown, each with its own vertical ruler
   * @defaultValue 1
   */
  labels?: number;
  children: ReactNode;
};

/** Where the pointer is on a label, and the label's box in the bench */
type Hover = Cursor & {
  fx: number;
  fy: number;
  box: { left: number; top: number; width: number; height: number };
};

const tickClass = (mm: number) =>
  mm % 10 === 0 ? "tick major" : mm % 5 === 0 ? "tick mid" : "tick";

/** Ticks every millimeter, or every 5 mm on long labels to stay readable */
const ticksFor = (lengthMm: number, step: number) =>
  Array.from(
    { length: Math.floor(lengthMm / step) + 1 },
    (_, index) => index * step
  );

/**
 * The label on its backing paper, between millimeter rulers along its top
 * and left edges. With onCursor, the position under the pointer is marked on
 * both rulers and with guide lines across the label.
 */
export default function Bench({
  widthMm,
  heightMm,
  onCursor,
  onPick,
  labels = 1,
  children,
}: BenchProps) {
  const [hover, setHover] = useState<Hover>();
  const step = Math.max(widthMm, heightMm) > 120 ? 5 : 1;
  const tracking = Boolean(onCursor || onPick);

  /** The label image under the pointer, inside <zpl-preview>'s shadow root */
  const locate = (event: MouseEvent<HTMLDivElement>): Hover | undefined => {
    const image = event.nativeEvent
      .composedPath()
      .find(
        (target): target is HTMLImageElement =>
          target instanceof HTMLImageElement &&
          target.getAttribute("part") === "label"
      );
    if (!image?.naturalWidth) return undefined;
    const rect = image.getBoundingClientRect();
    const area = event.currentTarget.getBoundingClientRect();
    const fx = Math.min(
      Math.max((event.clientX - rect.left) / rect.width, 0),
      1
    );
    const fy = Math.min(
      Math.max((event.clientY - rect.top) / rect.height, 0),
      1
    );
    const labels = [...(image.parentElement?.children ?? [])];
    return {
      x: Math.min(Math.floor(fx * image.naturalWidth), image.naturalWidth - 1),
      y: Math.min(
        Math.floor(fy * image.naturalHeight),
        image.naturalHeight - 1
      ),
      label: Math.max(labels.indexOf(image), 0),
      fx,
      fy,
      box: {
        left: rect.left - area.left,
        top: rect.top - area.top,
        width: rect.width,
        height: rect.height,
      },
    };
  };

  const move = (event: MouseEvent<HTMLDivElement>) => {
    const next = locate(event);
    setHover(next);
    onCursor?.(next && { x: next.x, y: next.y, label: next.label });
  };

  const leave = () => {
    setHover(undefined);
    onCursor?.(undefined);
  };

  return (
    <div className="bench">
      <div
        className="liner"
        style={{
          width: `min(100%, ${widthMm * MAX_PX_PER_MM + RULER_PX + 20}px)`,
        }}
      >
        <div
          className="frame"
          style={
            {
              "--ruler": `${RULER_PX}px`,
              "--aspect": heightMm / widthMm,
            } as CSSProperties
          }
        >
          <div
            className="ruler horizontal"
            role="img"
            aria-label={`${widthMm.toFixed(1)} mm wide`}
          >
            {ticksFor(widthMm, step).map((mm) => (
              <span
                key={mm}
                className={tickClass(mm)}
                style={{ left: `${(mm / widthMm) * 100}%` }}
              >
                {mm % 10 === 0 && mm > 0 && (
                  <span className="tick-label">{mm}</span>
                )}
              </span>
            ))}
            {hover && (
              <span
                className="marker"
                style={{ left: `${hover.fx * 100}%` }}
                aria-hidden="true"
              />
            )}
          </div>
          {/* Each label is its own piece of paper, measured from its top */}
          <div className="vertical-rulers">
            {Array.from({ length: Math.max(labels, 1) }, (_, index) => (
              <div
                key={index}
                className="ruler vertical"
                role="img"
                aria-label={`${heightMm.toFixed(1)} mm tall`}
              >
                {ticksFor(heightMm, step).map((mm) => (
                  <span
                    key={mm}
                    className={tickClass(mm)}
                    style={{ top: `${(mm / heightMm) * 100}%` }}
                  >
                    {mm % 10 === 0 && mm > 0 && (
                      <span className="tick-label">{mm}</span>
                    )}
                  </span>
                ))}
                {hover?.label === index && (
                  <span
                    className="marker"
                    style={{ top: `${hover.fy * 100}%` }}
                    aria-hidden="true"
                  />
                )}
              </div>
            ))}
          </div>
          <div
            className={`labels${tracking ? " tracking" : ""}`}
            onPointerMove={tracking ? move : undefined}
            onPointerDown={tracking ? move : undefined}
            onPointerLeave={tracking ? leave : undefined}
            onClick={
              onPick
                ? (event) => {
                    const at = locate(event);
                    if (at) onPick({ x: at.x, y: at.y, label: at.label });
                  }
                : undefined
            }
          >
            {children}
            {hover && (
              <div
                className="guides"
                style={{
                  left: hover.box.left,
                  top: hover.box.top,
                  width: hover.box.width,
                  height: hover.box.height,
                }}
                aria-hidden="true"
              >
                <span
                  className="guide vertical"
                  style={{ left: `${hover.fx * 100}%` }}
                />
                <span
                  className="guide horizontal"
                  style={{ top: `${hover.fy * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="size">
        {widthMm.toFixed(1)} × {heightMm.toFixed(1)} mm
      </p>
    </div>
  );
}

export type { Cursor };
