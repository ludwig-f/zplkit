"use client";

import dynamic from "next/dynamic";
import Skeleton from "./Skeleton";

/** The playground needs the DOM (CodeMirror, <zpl-preview>), so it renders in the browser only */
const Playground = dynamic(() => import("./Playground"), {
  ssr: false,
  loading: () => (
    <Skeleton tool="playground" tabs={["Code", "Preview", "Problems (0)"]} />
  ),
});

export default function PlaygroundLoader() {
  return <Playground />;
}
