"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  ReactNode,
} from "react";
import type { TransactionSpec } from "@codemirror/state";
import type { Rect } from "@zplkit/render/internal";
import "./overlay.css";
import type { Cursor } from "../Bench";
import type { Unit } from "../settings";
import { formatSize } from "../units";
import type { Edge } from "./align";
import { startDrag, type Drag, type DragKind, type Handle } from "./drag";
import { fieldAt, type Design } from "./fields";
import {
  grow,
  labelAt,
  moved,
  pxToDots,
  spanning,
  toDots,
  toScreen,
  union,
  type LabelBox,
} from "./geometry";
import { alignEdit, alignedEdges, keyEdit } from "./keys";
import {
  captionOf,
  captionSide,
  cropsFor,
  describeSelection,
  guideName,
  handlesFor,
  positionIn,
  problemKeys,
  tagOf,
} from "./overlay";
import {
  clickAt,
  pressAt,
  selectIn,
  twinsOf,
  type Hover,
  type Selection,
} from "./selection";
import type { Guide } from "./snap";

type DesignOverlayProps = {
  design: Design;
  /** Where each label image is, from the bench */
  boxes: LabelBox[];
  /** The label images, to draw moving fields from while the preview waits */
  images: string[];
  /** The ZPL the images were rendered from; moving fields are only cut from images of the design's ZPL */
  imagesZpl: string | undefined;
  selection: Selection;
  hover: Hover;
  problems: readonly { from: number }[];
  /** The unit the readout shows positions in, besides dots */
  unit: Unit;
  onSelect: (selection: Selection) => void;
  onHover: (hover: Hover) => void;
  /** Apply an edit to the editor */
  apply: (spec: TransactionSpec) => void;
  /** A drag that edits started or ended; the preview keeps its ZPL meanwhile */
  onDrag: (dragging: boolean) => void;
  /** Select the field at a text offset once the edit is in, e.g. a duplicate */
  onSelectAt: (offset: number) => void;
  /** Empty space was right-clicked */
  onPick: (cursor: Cursor) => void;
  onUndo: () => void;
  onRedo: () => void;
};

/** A drag in progress, from pointer down to pointer up */
type Active = {
  pointer: number;
  label: number;
  at: { x: number; y: number };
  kind: DragKind["kind"];
  /** Undefined for touch, which selects but doesn't drag */
  drag?: Drag;
  /** The selection the drag works on */
  selection: Selection;
  /** The selection a click without dragging picks from */
  clickFrom: Selection;
  /** Whether the drag selects `selection` once it starts, e.g. after an alt press */
  selectOnStart: boolean;
  /** Whether a click without dragging picks with clickAt on pointer up */
  click: boolean;
  started: boolean;
  /** What the latest step showed */
  last?: Shown;
};

/** What the current drag shows */
type Shown = {
  dx: number;
  dy: number;
  guides: Guide[];
  readout: string;
  bounds?: Rect;
  /** A selection box, in dots */
  box?: Rect;
};

/** Moved fields drawn from the label image, until the preview has redrawn */
type Ghost = { label: number; src: string; crops: { from: Rect; to: Rect }[] };

/** Fields are outlined this far outside their ink, in dots */
const OUTSET = 3;

/** How long a ghost waits for the preview at most, in ms */
const GHOST_MS = 3000;

const HANDLE_CURSORS: Record<Handle, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

/** Where a handle sits on its outline, in percent */
const HANDLE_AT: Record<Handle, [number, number]> = {
  nw: [0, 0],
  n: [50, 0],
  ne: [100, 0],
  e: [100, 50],
  se: [100, 100],
  s: [50, 100],
  sw: [0, 100],
  w: [0, 50],
};

const ALIGN: { how: Edge; label: string; path: string }[] = [
  {
    how: "left",
    label: "Align left edges",
    path: "M4 3v18M8 7h11M8 12h7M8 17h9",
  },
  {
    how: "center",
    label: "Align centers",
    path: "M12 3v18M6 7h12M8 12h8M5 17h14",
  },
  {
    how: "right",
    label: "Align right edges",
    path: "M20 3v18M5 7h11M9 12h7M7 17h9",
  },
  {
    how: "top",
    label: "Align top edges",
    path: "M3 4h18M7 8v11M12 8v7M17 8v9",
  },
  {
    how: "middle",
    label: "Align middles",
    path: "M3 12h18M7 6v12M12 8v8M17 5v14",
  },
  {
    how: "bottom",
    label: "Align bottom edges",
    path: "M3 20h18M7 5v11M12 9v7M17 7v9",
  },
];

const place = (rect: Rect): CSSProperties => ({
  left: rect.x,
  top: rect.y,
  width: rect.width,
  height: rect.height,
});

const Icon = ({ path, children }: { path?: string; children?: ReactNode }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    {path && <path d={path} />}
    {children}
  </svg>
);

/**
 * The designer over the labels: outlines for hovered, selected and flagged
 * fields, handles, guides and the align bar, and the pointer and keyboard
 * plumbing that turns them into edits.
 */
export default function DesignOverlay({
  design,
  boxes: measured,
  images,
  imagesZpl,
  selection,
  hover,
  problems,
  unit,
  onSelect,
  onHover,
  apply,
  onDrag,
  onSelectAt,
  onPick,
  onUndo,
  onRedo,
}: DesignOverlayProps) {
  const root = useRef<HTMLDivElement>(null);
  const active = useRef<Active | undefined>(undefined);
  const [shown, setShown] = useState<Shown>();
  const [ghost, setGhost] = useState<Ghost>();

  // Boxes in the design's dots, for the labels both have
  const boxes = useMemo(
    () =>
      measured.slice(0, design.labels.length).map((box, i) => ({
        ...box,
        dotsWide: design.labels[i].width,
        dotsHigh: design.labels[i].height,
      })),
    [measured, design]
  );
  const flagged = useMemo(
    () => problemKeys(design, problems),
    [design, problems]
  );

  // The ghost goes once the preview shows the new labels
  useEffect(() => setGhost(undefined), [images]);
  useEffect(() => {
    if (!ghost) return;
    const timeout = setTimeout(() => setGhost(undefined), GHOST_MS);
    return () => clearTimeout(timeout);
  }, [ghost]);

  // Leaving mid-drag must not keep the preview frozen
  const onDragRef = useRef(onDrag);
  onDragRef.current = onDrag;
  useEffect(
    () => () => {
      const drag = active.current;
      if (drag?.started && drag.kind !== "box") onDragRef.current(false);
    },
    []
  );

  /** Whether the label images show the design's ZPL, so fields can be cut from them */
  const fresh = imagesZpl === design.zpl;

  /** The pointer, in px from the overlay's corner */
  const pointOf = (event: { clientX: number; clientY: number }) => {
    const rect = root.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  /** The label under the pointer and the point on it in dots */
  const locate = (event: { clientX: number; clientY: number }) => {
    const { x, y } = pointOf(event);
    const label = labelAt(boxes, x, y);
    if (label === undefined || !boxes[label].width) return undefined;
    return { label, at: toDots(boxes[label], x, y) };
  };

  const fieldsOn = (label: number) => design.labels[label]?.fields ?? [];
  const selectedOn = (label: number) =>
    selection.label === label
      ? fieldsOn(label).filter((f) => selection.keys.includes(f.key))
      : [];

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || active.current) return;
    root.current?.focus({ preventScroll: true });
    // A handle can stick out past the label's edge, so it goes by the selection's label
    const handle = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-handle]"
    )?.dataset.handle as Handle | undefined;
    const box = boxes[selection.label];
    const found =
      handle && box?.width
        ? {
            label: selection.label,
            at: toDots(box, pointOf(event).x, pointOf(event).y),
          }
        : locate(event);
    if (!found) {
      if (!event.shiftKey) onSelect({ keys: [], label: selection.label });
      return;
    }
    const { label, at } = found;
    setGhost(undefined);

    const press = pressAt(design, selection, label, at, {
      handle,
      shift: event.shiftKey,
      alt: event.altKey,
    });
    if (press.selection !== selection) onSelect(press.selection);

    // Touch selects but doesn't drag, so the page still scrolls
    const touch = event.pointerType === "touch";
    active.current = {
      pointer: event.pointerId,
      label,
      at,
      kind: press.kind.kind,
      drag: touch
        ? undefined
        : startDrag(
            design,
            press.moves ?? press.selection,
            label,
            at,
            press.kind
          ),
      selection: press.moves ?? press.selection,
      clickFrom: press.selection,
      selectOnStart: press.moves !== undefined,
      click: press.clickOnUp,
      started: false,
    };
    if (!touch) event.currentTarget.setPointerCapture(event.pointerId);
  };

  /**
   * End the drag: a press that never moved is a click (unless the pointer
   * was taken away), a box selects what's in it, and moved fields stay
   * drawn from the old image until the preview redraws
   */
  const finish = (
    drag: Active,
    mods: { shiftKey: boolean; altKey: boolean },
    cancelled: boolean
  ) => {
    active.current = undefined;
    const { last } = drag;
    setShown(undefined);

    if (!drag.started) {
      if (drag.click && !cancelled) {
        onSelect(
          clickAt(design, drag.clickFrom, drag.label, drag.at.x, drag.at.y, {
            shift: mods.shiftKey,
            alt: mods.altKey,
          })
        );
      }
      return;
    }
    if (drag.kind === "box") {
      if (last?.box && !cancelled) {
        onSelect(
          selectIn(design, drag.label, last.box, mods.shiftKey, drag.selection)
        );
      }
      return;
    }

    const src = images[drag.label];
    if (src && last && fresh) {
      setGhost({
        label: drag.label,
        src,
        crops: cropsFor(
          design,
          drag.label,
          drag.selection.keys,
          drag.kind,
          last
        ),
      });
    }
    onDrag(false);
  };

  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = active.current;
    if (!drag) {
      const found = locate(event);
      const field =
        found && fieldAt(design.labels[found.label], found.at.x, found.at.y);
      onHover(field && found && { key: field.key, label: found.label });
      return;
    }
    if (drag.pointer !== event.pointerId || !drag.drag) return;
    // The button came up where we didn't hear it
    if (event.buttons === 0) {
      finish(drag, event, false);
      return;
    }
    const box = boxes[drag.label];
    if (!box) return;
    const { x, y } = pointOf(event);
    const at = toDots(box, x, y);
    const step = drag.drag.moveTo(at, {
      snap: !event.altKey,
      pxToDots: pxToDots(box, 1),
    });
    if (!step.started) return;
    if (!drag.started) {
      drag.started = true;
      onHover(undefined);
      if (drag.selectOnStart) onSelect(drag.selection);
      // Before the first edit, so the preview keeps the ZPL from before
      if (drag.kind !== "box") onDrag(true);
    }
    if (step.edit) apply(step.edit);
    drag.last = {
      dx: step.dx,
      dy: step.dy,
      guides: step.guides,
      readout: step.readout,
      bounds: step.bounds,
      box: drag.kind === "box" ? spanning(drag.at, at) : undefined,
    };
    setShown(drag.last);
  };

  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = active.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    // Finished before letting go, so a lostpointercapture fired right away
    // finds no drag
    active.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finish(drag, event, false);
  };

  /** The browser took the pointer, e.g. to scroll: keep what's applied, but no click */
  const pointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    const drag = active.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    finish(drag, event, true);
  };

  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Keys on the align bar's buttons are theirs
    if (event.target !== event.currentTarget || active.current) return;
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (mod && (key === "z" || key === "y")) {
      event.preventDefault();
      if (key === "y" || event.shiftKey) onRedo();
      else onUndo();
      return;
    }
    const result = keyEdit(design, selection, {
      key: event.key,
      shift: event.shiftKey,
      mod,
    });
    if (!result) return;
    event.preventDefault();
    if (result.edit) apply(result.edit);
    if (result.selection) onSelect(result.selection);
    if (result.selectAt !== undefined) onSelectAt(result.selectAt);
  };

  const contextMenu = (event: MouseEvent<HTMLDivElement>) => {
    // No menu in the middle of a drag
    if (active.current) {
      event.preventDefault();
      return;
    }
    const found = locate(event);
    if (!found) return;
    const { label, at } = found;
    if (fieldAt(design.labels[label], at.x, at.y)) return;
    event.preventDefault();
    const { width, height } = design.labels[label];
    onPick({
      x: Math.min(Math.max(Math.floor(at.x), 0), width - 1),
      y: Math.min(Math.max(Math.floor(at.y), 0), height - 1),
      label,
    });
  };

  const dragging = Boolean(shown && shown.box === undefined);
  const single = selection.keys.length === 1;

  /** The outline of a field on a label, in px */
  const outline = (label: number, rect: Rect) =>
    toScreen(boxes[label], grow(rect, OUTSET));

  const drawn: ReactNode[] = [];
  boxes.forEach((box, label) => {
    if (!box.width) return;
    const selected = new Set(selectedOn(label).map((f) => f.key));
    for (const field of fieldsOn(label)) {
      const isSelected = selected.has(field.key);
      const isHovered =
        !isSelected &&
        !dragging &&
        hover?.label === label &&
        hover.key === field.key;
      const warn = flagged.has(field.key);
      const caption = captionOf(design, field);
      if (!isSelected && !isHovered && !warn && !caption) continue;

      let rect = field.bounds;
      if (isSelected && shown && dragging) {
        rect =
          active.current?.kind === "resize" && shown.bounds
            ? shown.bounds
            : moved(rect, shown.dx, shown.dy);
      }
      const classes = ["field"];
      if (caption) classes.push("not-drawn");
      if (warn) classes.push("warn");
      if (isHovered) classes.push("hovered");
      if (isSelected) classes.push("selected");
      const showHandles = isSelected && single && !dragging;
      const placed = outline(label, rect);
      drawn.push(
        <div
          key={`${label}-${field.key}`}
          className={classes.join(" ")}
          style={place(placed)}
        >
          {caption && (
            <span
              className={`caption ${captionSide({
                top: placed.y,
                labelTop: box.top,
                selected: isSelected && single && !dragging,
              })}`}
            >
              {caption}
            </span>
          )}
          {warn && <span className="diamond" />}
          {isSelected && single && !dragging && (
            <span className="tag">{tagOf(design, field)}</span>
          )}
          {showHandles &&
            handlesFor(design, field).map((handle) => (
              <span
                key={handle}
                className="handle"
                data-handle={handle}
                style={{
                  left: `${HANDLE_AT[handle][0]}%`,
                  top: `${HANDLE_AT[handle][1]}%`,
                  cursor: HANDLE_CURSORS[handle],
                }}
              />
            ))}
        </div>
      );
    }
  });

  // The same fields on the other labels
  const twins = twinsOf(design, selection)
    .filter(({ label }) => boxes[label]?.width)
    .map(({ label, field }) => (
      <div
        key={`twin-${label}-${field.key}`}
        className="field twin"
        style={place(outline(label, field.bounds))}
      />
    ));

  // While dragging: guides with names, and the readout under the field
  let readout: ReactNode;
  let guides: ReactNode[] = [];
  const drag = active.current;
  if (shown && dragging && drag && boxes[drag.label]) {
    const box = boxes[drag.label];
    const label = design.labels[drag.label];
    const moving = drag.selection.keys;
    const others = label.fields
      .filter((f) => !moving.includes(f.key))
      .map((f) => f.bounds);
    const first = label.fields.find((f) => moving.includes(f.key));
    const at = shown.bounds && toScreen(box, shown.bounds);
    guides = shown.guides.map((guide: Guide) => {
      const line = toScreen(
        box,
        guide.axis === "x"
          ? { x: guide.at, y: 0, width: 0, height: label.height }
          : { x: 0, y: guide.at, width: label.width, height: 0 }
      );
      const style: CSSProperties =
        guide.axis === "x"
          ? { left: line.x, top: line.y, height: line.height }
          : { left: line.x, top: line.y, width: line.width };
      const name: CSSProperties =
        guide.axis === "x"
          ? { top: at ? at.y + at.height + 8 - line.y : 8 }
          : { left: at ? at.x + at.width + 8 - line.x : 8 };
      return (
        <span
          key={`${guide.axis}${guide.at}`}
          className={`guide ${guide.axis}`}
          style={style}
        >
          <span className="guide-name" style={name}>
            {guideName(guide, label, others)}
          </span>
        </span>
      );
    });
    if (at && first && shown.readout) {
      const detail =
        drag.kind === "resize" && shown.bounds
          ? formatSize(
              Math.round(shown.bounds.width),
              Math.round(shown.bounds.height),
              unit,
              design.dpmm
            )
          : positionIn(design, first, shown.readout, unit);
      readout = (
        <span
          className="readout"
          style={{ left: at.x + at.width / 2, top: at.y + at.height + 8 }}
        >
          {shown.readout}
          {detail && <span className="readout-unit">{detail}</span>}
        </span>
      );
    }
  }

  // A selection box
  const marquee =
    shown?.box && drag && boxes[drag.label] ? (
      <div
        className="marquee"
        style={place(toScreen(boxes[drag.label], shown.box))}
      />
    ) : undefined;

  // The align bar above several selected fields
  let bar: ReactNode;
  const group = selectedOn(selection.label);
  if (group.length > 1 && !shown && boxes[selection.label]?.width) {
    const around = union(group.map((f) => outline(selection.label, f.bounds)));
    const lined = alignedEdges(design, selection);
    const button = (
      how: Parameters<typeof alignEdit>[2],
      label: string,
      icon: ReactNode,
      on = false,
      disabled = false
    ) => (
      <button
        key={how}
        type="button"
        className={on ? "on" : undefined}
        aria-label={label}
        aria-pressed={on}
        title={label}
        disabled={disabled}
        onClick={() => apply(alignEdit(design, selection, how))}
      >
        {icon}
      </button>
    );
    bar = (
      <div
        className="align-bar"
        role="toolbar"
        aria-label="Align"
        style={{ left: around.x, top: around.y }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <span className="count">{group.length} fields</span>
        <span className="sep" />
        {ALIGN.slice(0, 3).map(({ how, label, path }) =>
          button(how, label, <Icon path={path} />, lined.includes(how))
        )}
        <span className="sep" />
        {ALIGN.slice(3).map(({ how, label, path }) =>
          button(how, label, <Icon path={path} />, lined.includes(how))
        )}
        <span className="sep" />
        {button(
          "distribute-x",
          "Distribute horizontally",
          <Icon path="M4 4v16M20 4v16">
            <rect x="9.5" y="8" width="5" height="8" rx="1" />
          </Icon>,
          false,
          group.length < 3
        )}
        {button(
          "distribute-y",
          "Distribute vertically",
          <Icon path="M4 4h16M4 20h16">
            <rect x="8" y="9.5" width="8" height="5" rx="1" />
          </Icon>,
          false,
          group.length < 3
        )}
      </div>
    );
  }

  // Moving fields, cut from the label image: during a drag from the frozen
  // preview, after it until the preview has the new labels
  let crops: { from: Rect; to: Rect }[] = [];
  let cropLabel = -1;
  let cropSrc: string | undefined;
  if (shown && dragging && drag && fresh) {
    // Only from images of the design's ZPL; outlines alone otherwise
    cropLabel = drag.label;
    cropSrc = images[drag.label];
    crops = cropsFor(design, drag.label, drag.selection.keys, drag.kind, shown);
  } else if (ghost) {
    cropLabel = ghost.label;
    cropSrc = ghost.src;
    crops = ghost.crops;
  }
  const box = boxes[cropLabel];
  const cut =
    box?.width && cropSrc
      ? crops.map(({ from, to }, i) => {
          const source = toScreen(box, grow(from, 1));
          const target = toScreen(box, {
            x: to.x - (to.width / from.width) * 1,
            y: to.y - (to.height / from.height) * 1,
            width: to.width + (to.width / from.width) * 2,
            height: to.height + (to.height / from.height) * 2,
          });
          const sx = target.width / source.width;
          const sy = target.height / source.height;
          return [
            <div
              key={`mask-${i}`}
              className="mask label-dim"
              style={place(source)}
            />,
            <div
              key={`crop-${i}`}
              className="crop label-dim"
              style={{
                ...place(target),
                backgroundImage: `url(${cropSrc})`,
                backgroundSize: `${box.width * sx}px ${box.height * sy}px`,
                backgroundPosition: `${-(source.x - box.left) * sx}px ${
                  -(source.y - box.top) * sy
                }px`,
              }}
            />,
          ];
        })
      : [];

  return (
    <div
      ref={root}
      className="designer"
      tabIndex={0}
      role="application"
      aria-label={describeSelection(design, selection)}
      data-hovering={hover ? "" : undefined}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerCancel}
      onLostPointerCapture={(event) => {
        const drag = active.current;
        if (drag?.pointer === event.pointerId) finish(drag, event, true);
      }}
      onPointerLeave={() => {
        if (!active.current) onHover(undefined);
      }}
      onKeyDown={keyDown}
      onContextMenu={contextMenu}
    >
      {cut.flat()}
      {twins}
      {drawn}
      {guides}
      {marquee}
      {readout}
      {bar}
    </div>
  );
}
