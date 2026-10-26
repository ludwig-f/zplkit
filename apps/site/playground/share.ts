/** A label side, in the unit it was picked in */
type LabelLength = { mm: number } | { inches: number };

/** Everything a shared link restores */
type ShareState = {
  zpl: string;
  width: LabelLength | undefined;
  height: LabelLength | undefined;
  dpmm: number;
  smoothing: number;
};

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromBase64Url = (text: string): Uint8Array =>
  Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (char) =>
    char.charCodeAt(0)
  );

/** Millimeters as a plain number, as links had them before inches */
const encodeLength = (length: LabelLength | undefined) =>
  length === undefined ? null : "mm" in length ? length.mm : length;

const decodeLength = (value: unknown): LabelLength | undefined => {
  if (typeof value === "number") return { mm: value };
  if (
    value &&
    typeof value === "object" &&
    "inches" in value &&
    typeof value.inches === "number"
  ) {
    return { inches: value.inches };
  }
  return undefined;
};

const transform = async (
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream
): Promise<Uint8Array> =>
  new Uint8Array(
    await new Response(
      new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
    ).arrayBuffer()
  );

/**
 * Encode the label and settings into a compact, URL-safe string for the
 * link's #fragment. Nothing is sent to a server.
 */
const encodeShare = async (state: ShareState): Promise<string> => {
  const json = JSON.stringify([
    state.zpl,
    encodeLength(state.width),
    encodeLength(state.height),
    state.dpmm,
    state.smoothing,
  ]);
  const compressed = await transform(
    new TextEncoder().encode(json),
    new CompressionStream("deflate-raw")
  );

  return toBase64Url(compressed);
};

/** Read a string from encodeShare(), or undefined if it isn't one */
const decodeShare = async (text: string): Promise<ShareState | undefined> => {
  try {
    const bytes = await transform(
      fromBase64Url(text),
      new DecompressionStream("deflate-raw")
    );
    const [zpl, width, height, dpmm, smoothing] = JSON.parse(
      new TextDecoder().decode(bytes)
    );

    if (typeof zpl !== "string" || typeof dpmm !== "number") {
      return undefined;
    }

    return {
      zpl,
      width: decodeLength(width),
      height: decodeLength(height),
      dpmm,
      smoothing: typeof smoothing === "number" ? smoothing : 0.4,
    };
  } catch {
    return undefined;
  }
};

/** Everything a shared playground link restores */
type CodeShareState = {
  code: string;
  smoothing: number;
};

/** Encode playground code like encodeShare(), as an object so the two differ */
const encodeCodeShare = async (state: CodeShareState): Promise<string> =>
  toBase64Url(
    await transform(
      new TextEncoder().encode(
        JSON.stringify({ code: state.code, smoothing: state.smoothing })
      ),
      new CompressionStream("deflate-raw")
    )
  );

/** Read a string from encodeCodeShare(), or undefined if it isn't one */
const decodeCodeShare = async (
  text: string
): Promise<CodeShareState | undefined> => {
  try {
    const bytes = await transform(
      fromBase64Url(text),
      new DecompressionStream("deflate-raw")
    );
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (Array.isArray(value) || typeof value?.code !== "string") {
      return undefined;
    }
    return {
      code: value.code,
      smoothing: typeof value.smoothing === "number" ? value.smoothing : 0.4,
    };
  } catch {
    return undefined;
  }
};

export type { LabelLength, ShareState, CodeShareState };
export { encodeShare, decodeShare, encodeCodeShare, decodeCodeShare };
