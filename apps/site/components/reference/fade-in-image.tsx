"use client";

import { useState } from "react";
import type { ImgHTMLAttributes } from "react";

/** An image that fades in once it has loaded, instead of popping in */
export function FadeInImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      {...props}
      // Cached images can finish loading before React listens for it
      ref={(image) => {
        if (image?.complete) setLoaded(true);
      }}
      onLoad={() => setLoaded(true)}
      className={`${
        props.className ?? ""
      } transition-opacity duration-200 motion-reduce:transition-none ${
        loaded ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
