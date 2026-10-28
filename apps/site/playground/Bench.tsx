"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode, RefObject } from "react";
import "./bench.css";
import { labelAt, type LabelBox } from "./designer/geometry";
import type { Unit } from "./settings";
import { formatDots, formatSize, fromDots, ticksFor } from "./units";
import type { Tick } from "./units";

/** Screen pixels per millimeter at most, so small labels aren't blown up */
const MAX_PX_PER_MM = 6;

/** Width of the vertical ruler, which the horizontal one starts after */
const RULER_PX = 32;

/** A position on a label, in dots from its top-left corner */
type Cursor = { x: number; y: number; label: number };

type BenchProps = {
  widthMm: number;
  heightMm: number;
  /** Dots per millimeter, to measure in dots and inches */
  dpmm: number;
  /** The unit the rulers and the size are in */
  unit: Unit;
  /** Called with the position under the pointer, or undefined when it leaves */
  onCursor?: (cursor: Cursor | undefined) => void;
  /** Called when a label is clicked, with the position clicked */
  onPick?: (cursor: Cursor) => void;
  /** Drawn over the labels, given where each label image is */
  overlay?: (boxes: LabelBox[]) => ReactNode;
  /** Hide the pointer's guide lines, e.g. while the overlay has a selection */
  quiet?: boolean;
  /** A span to mark on the rulers, in dots on a label, e.g. the selected fields */
  extent?: {
    label: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
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

/** Whether two lists of boxes are the same, to px */
const sameBoxes = (a: LabelBox[], b: LabelBox[]) =>
  a.length === b.length &&
  a.every((box, i) =>
    (Object.keys(box) as (keyof LabelBox)[]).every(
      (key) => Math.abs(box[key] - b[i][key]) < 0.5
    )
  );

/**
 * Keep track of where <zpl-preview>'s label images are in an element, in
 * px from its top-left corner. The images are in the preview's shadow root
 * and replaced on every render; their size is known once they've loaded.
 */
const useLabelBoxes = (area: RefObject<HTMLDivElement | null>) => {
  const [boxes, setBoxes] = useState<LabelBox[]>([]);
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    let frame = 0;
    let root: ShadowRoot | undefined;

    const measure = () => {
      frame = 0;
      const origin = element.getBoundingClientRect();
      const images = root
        ? [...root.querySelectorAll<HTMLImageElement>('img[part="label"]')]
        : [];
      const next = images.map((image) => {
        const rect = image.getBoundingClientRect();
        return {
          left: rect.left - origin.left,
          top: rect.top - origin.top,
          width: rect.width,
          height: rect.height,
          dotsWide: image.naturalWidth,
          dotsHigh: image.naturalHeight,
        };
      });
      setBoxes((current) => (sameBoxes(current, next) ? current : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    // Images change size when they load and when the bench does
    const sizes = new ResizeObserver(schedule);
    const observeImages = () => {
      sizes.disconnect();
      sizes.observe(element);
      root
        ?.querySelectorAll('img[part="label"]')
        .forEach((image) => sizes.observe(image));
      schedule();
    };
    const images = new MutationObserver(observeImages);

    /** Follow the preview element's shadow root, once it has one */
    const connect = () => {
      const next =
        element.querySelector("zpl-preview")?.shadowRoot ?? undefined;
      if (next === root) return;
      root?.removeEventListener("load", schedule, true);
      images.disconnect();
      root = next;
      if (root) {
        images.observe(root, { childList: true, subtree: true });
        // load doesn't bubble, so it's caught on the way down
        root.addEventListener("load", schedule, true);
      }
      observeImages();
    };
    const children = new MutationObserver(connect);
    children.observe(element, { childList: true });
    connect();
    let live = true;
    void customElements.whenDefined("zpl-preview").then(() => {
      if (live) connect();
    });

    return () => {
      live = false;
      cancelAnimationFrame(frame);
      sizes.disconnect();
      images.disconnect();
      children.disconnect();
      root?.removeEventListener("load", schedule, true);
    };
  }, [area]);
  return boxes;
};

const tickClass = (tick: Tick) =>
  tick.kind === "minor" ? "tick" : `tick ${tick.kind}`;

/**
 * The label on its backing paper, between rulers along its top and left
 * edges, in millimeters, inches or dots. With onCursor, the position under the pointer is marked on
 * both rulers and with guide lines across the label.
 */
export default function Bench({
  widthMm,
  heightMm,
  dpmm,
  unit,
  onCursor,
  onPick,
  overlay,
  quiet = false,
  extent,
  labels = 1,
  children,
}: BenchProps) {
  const [hover, setHover] = useState<Hover>();
  const area = useRef<HTMLDivElement>(null);
  const boxes = useLabelBoxes(area);
  const widthDots = Math.round(widthMm * dpmm);
  const heightDots = Math.round(heightMm * dpmm);
  // The sides in the ruler's unit
  const width = fromDots(widthDots, unit, dpmm);
  const height = fromDots(heightDots, unit, dpmm);
  // Both rulers step alike, by the longer side
  const longest = Math.max(width, height);
  const ticks = (length: number) =>
    ticksFor(longest, unit).filter((tick) => tick.at <= length + 1e-9);
  const tracking = Boolean(onCursor || onPick);

  /** The label under the pointer, and where on it */
  const locate = (event: MouseEvent<HTMLDivElement>): Hover | undefined => {
    const origin = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - origin.left;
    const py = event.clientY - origin.top;
    const label = labelAt(boxes, px, py);
    const box = label === undefined ? undefined : boxes[label];
    if (label === undefined || !box?.dotsWide || !box.dotsHigh) {
      return undefined;
    }
    const fx = Math.min(Math.max((px - box.left) / box.width, 0), 1);
    const fy = Math.min(Math.max((py - box.top) / box.height, 0), 1);
    return {
      x: Math.min(Math.floor(fx * box.dotsWide), box.dotsWide - 1),
      y: Math.min(Math.floor(fy * box.dotsHigh), box.dotsHigh - 1),
      label,
      fx,
      fy,
      box: {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
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
            aria-label={`${formatDots(widthDots, unit, dpmm)} ${unit} wide`}
          >
            {ticks(width).map((tick) => (
              <span
                key={tick.at}
                className={tickClass(tick)}
                style={{ left: `${(tick.at / width) * 100}%` }}
              >
                {tick.label !== undefined && (
                  <span className="tick-label">{tick.label}</span>
                )}
              </span>
            ))}
            {extent && (
              <span
                className="extent"
                style={{
                  left: `${(extent.x / widthDots) * 100}%`,
                  width: `${(extent.width / widthDots) * 100}%`,
                }}
                aria-hidden="true"
              />
            )}
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
                aria-label={`${formatDots(
                  heightDots,
                  unit,
                  dpmm
                )} ${unit} tall`}
              >
                {ticks(height).map((tick) => (
                  <span
                    key={tick.at}
                    className={tickClass(tick)}
                    style={{ top: `${(tick.at / height) * 100}%` }}
                  >
                    {tick.label !== undefined && (
                      <span className="tick-label">{tick.label}</span>
                    )}
                  </span>
                ))}
                {extent?.label === index && (
                  <span
                    className="extent"
                    style={{
                      top: `${(extent.y / heightDots) * 100}%`,
                      height: `${(extent.height / heightDots) * 100}%`,
                    }}
                    aria-hidden="true"
                  />
                )}
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
            ref={area}
            className={`labels${tracking && !overlay ? " tracking" : ""}`}
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
            {overlay?.(boxes)}
            {hover && !quiet && (
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
      <p className="size">{formatSize(widthDots, heightDots, unit, dpmm)}</p>
    </div>
  );
}

export type { Cursor };
