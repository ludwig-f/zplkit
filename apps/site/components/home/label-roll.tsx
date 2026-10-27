"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

/** Space between labels on the liner, in pixels */
const LABEL_GAP = 14;

/** How much of the next label shows below the printer's exit */
const PEEK = 12;

/** How long a label takes to feed out, and how it eases to a stop */
const FEED_MS = 1400;
const FEED_EASING = "cubic-bezier(0.3, 0.1, 0.25, 1)";

/** Time from one label to the next */
const EVERY_MS = 4500;

/**
 * Labels already printed when the page loads, all copies of the first, so
 * the liner runs off the bottom of the frame from the start
 */
const COPIES = 3;

/** Which of the sources print number n shows: copies first, then each in turn */
const labelFor = (n: number, count: number) =>
  n < COPIES ? 0 : (n - COPIES + 1) % count;

/**
 * Labels coming out of a printer on their liner, one every few seconds:
 * the next one, still blank, at the exit, the newest printed one under it,
 * and the ones before feeding off the bottom of the frame. The first label
 * feeds out with CSS, so it moves before the page's script runs; the rest
 * follow once it has. Nothing moves with reduced motion, or while the
 * labels are out of view.
 */
export function LabelRoll({
  sources,
  width,
  height,
  alt,
}: {
  /**
   * The labels to print in turn. The first is shown before any script, so
   * it's best inlined; it's kept once, in a CSS variable, for every copy.
   */
  sources: string[];
  width: number;
  height: number;
  /** What the labels show, said once for all of them */
  alt: string;
}) {
  // How many labels have been printed; the newest is printed - 1
  const [printed, setPrinted] = useState(COPIES);
  const count = useRef(COPIES);
  const liner = useRef<HTMLDivElement>(null);
  const pitch = height + LABEL_GAP;
  const radius = Math.round((12 * width) / 400);
  const paper: CSSProperties = {
    width,
    height,
    borderRadius: radius,
    boxShadow: "0 0 0 1px var(--zk-label-edge)",
  };

  // A new label pushes the others down a label. Start the liner a label
  // up, where it was, and feed it down.
  useLayoutEffect(() => {
    if (printed === COPIES) return;
    liner.current?.animate(
      [{ transform: `translateY(${-pitch}px)` }, { transform: "none" }],
      { duration: FEED_MS, easing: FEED_EASING }
    );
  }, [printed, pitch]);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const element = liner.current;
    if (!element) return;
    let visible = false;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(element);
    const timer = setInterval(async () => {
      if (!visible || document.hidden) return;
      // Load the next label before feeding it, so it never shows blank
      const image = new Image();
      image.src = sources[labelFor(count.current, sources.length)];
      try {
        await image.decode();
      } catch {
        return;
      }
      count.current += 1;
      setPrinted(count.current);
    }, EVERY_MS);
    return () => {
      clearInterval(timer);
      observer.disconnect();
    };
  }, [sources]);

  // The newest label and the two before it. The second shows at the
  // bottom of the frame; the third is there when a feed starts, a label up.
  const shown = [printed - 1, printed - 2, printed - 3].filter((n) => n >= 0);

  return (
    <div
      ref={liner}
      role="img"
      aria-label={alt}
      className="flex flex-col items-center self-start bg-(--zk-roll) px-3.5 pb-[26px] shadow-[0_1px_0_var(--zk-rule-strong),0_10px_30px_-14px_rgb(0_0_0/0.35)] motion-safe:animate-[feed_1.4s_cubic-bezier(0.3,0.1,0.25,1)_both]"
      style={
        {
          "--label-first": `url("${sources[0]}")`,
          gap: LABEL_GAP,
          // Only the bottom of the next label is out of the printer
          marginTop: -(height - PEEK),
          // One label and the gap after it, how far each feed moves
          "--pitch": `${pitch}px`,
        } as CSSProperties
      }
    >
      <div className="bg-paper" style={paper} />
      {shown.map((n) => {
        const index = labelFor(n, sources.length);
        return (
          <div
            // Keyed by print, so a label keeps its element as it moves down
            key={n}
            className="label-dim bg-paper"
            style={{
              ...paper,
              backgroundImage:
                index === 0 ? "var(--label-first)" : `url("${sources[index]}")`,
              backgroundSize: "100% 100%",
            }}
          />
        );
      })}
    </div>
  );
}
