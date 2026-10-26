/**
 * Registers <zpl-preview> and adds its props to React's JSX types.
 * Needs React 19, which sets props on custom elements as properties.
 */
import "./index.js";
import type {
  ErrorDetail,
  RenderDetail,
  RenderStartDetail,
  ZplPreview,
  ZplSource,
} from "./index.js";
import type { HTMLAttributes, RefAttributes } from "react";

type ZplPreviewProps = HTMLAttributes<ZplPreview> &
  RefAttributes<ZplPreview> & {
    zpl?: ZplSource;
    width?: number;
    height?: number;
    dpmm?: number;
    smoothing?: number;
    fade?: boolean;
    fonts?: Record<string, Uint8Array>;
    font0?: Uint8Array;
    "onzpl-render-start"?: (event: CustomEvent<RenderStartDetail>) => void;
    "onzpl-render"?: (event: CustomEvent<RenderDetail>) => void;
    "onzpl-error"?: (event: CustomEvent<ErrorDetail>) => void;
  };

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "zpl-preview": ZplPreviewProps;
    }
  }
}

export type { ZplPreviewProps };
