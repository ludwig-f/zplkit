import "server-only";
import type { ReactNode } from "react";
import { ImageResponse } from "next/og";
import examples from "@/playground/examples";
import { renderLabel } from "./render-label";

const ink = "#191813";
const bg = "#f4f2ec";
const muted = "#5c594f";

type Font = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600 | 800;
  style: "normal";
};

/**
 * One font from Google Fonts as TrueType. Servers get one static file per
 * font rather than subsets. The images are made at build time, so this runs
 * once per font while building.
 */
const googleFont = async (
  family: string,
  axes: string,
  weight: Font["weight"]
): Promise<Font | undefined> => {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family}:${axes}`
    ).then((response) => response.text());
    const url = css.match(/src: url\((.+?)\)/)?.[1];
    if (!url) return undefined;
    const data = await fetch(url).then((response) => response.arrayBuffer());
    return { name: family.replace(/\+/g, " "), data, weight, style: "normal" };
  } catch {
    // Without network the images fall back to the default font
    return undefined;
  }
};

let fonts: Promise<Font[]> | undefined;
const loadFonts = () =>
  (fonts ??= Promise.all([
    googleFont("Archivo", "wdth,wght@112.5,800", 800),
    googleFont("Archivo", "wght@400", 400),
    googleFont("IBM+Plex+Mono", "wght@600", 600),
  ]).then((list) => list.filter((font) => font !== undefined)));

let label: Promise<string> | undefined;
/** The shipping label example, for docs pages */
const loadLabel = () =>
  (label ??= renderLabel(examples[0].zpl, {
    widthMm: 101.5,
    heightMm: 152.25,
    dpmm: 8,
  }));

const Wordmark = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      fontFamily: "Archivo",
      fontWeight: 800,
      fontSize: 44,
      letterSpacing: "-0.02em",
      color: ink,
    }}
  >
    <div
      style={{
        display: "flex",
        background: ink,
        color: bg,
        borderRadius: 5,
        padding: "0 6px 4px",
      }}
    >
      zpl
    </div>
    <div style={{ paddingLeft: 2 }}>kit</div>
  </div>
);

/**
 * A link preview, 1200 × 630: the wordmark top left, where the page is in
 * small mono type, then its title large
 */
export async function ogImage({
  section,
  title,
  description,
  aside,
}: {
  section: string;
  title: ReactNode;
  description?: string;
  /** Shown to the right of the text */
  aside?: ReactNode;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: "64px 72px",
          background: bg,
          color: ink,
          fontFamily: "Archivo",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "space-between",
          }}
        >
          <Wordmark />
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                fontFamily: "IBM Plex Mono",
                fontWeight: 600,
                fontSize: 22,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: muted,
              }}
            >
              {section}
            </div>
            {title}
            {description && (
              <div
                style={{
                  fontSize: 30,
                  lineHeight: 1.35,
                  color: "#34322b",
                  maxWidth: aside ? 640 : 900,
                }}
              >
                {description}
              </div>
            )}
          </div>
        </div>
        {aside}
      </div>
    ),
    {
      width: 1200,
      height: 630,
      // Leaving fonts out uses the default font
      fonts: (await loadFonts()).length ? await loadFonts() : undefined,
    }
  );
}

/** A large page title */
export const OgTitle = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      fontWeight: 800,
      fontSize: 88,
      lineHeight: 1,
      letterSpacing: "-0.025em",
    }}
  >
    {children}
  </div>
);

/** The example shipping label on its liner, for docs pages */
export async function OgLabel() {
  return (
    <div
      style={{
        display: "flex",
        alignSelf: "center",
        marginLeft: 48,
        padding: 14,
        background: "#e3d9be",
        borderRadius: 6,
      }}
    >
      <img
        src={await loadLabel()}
        width={270}
        height={405}
        alt=""
        style={{ borderRadius: 10, background: "#ffffff" }}
      />
    </div>
  );
}
