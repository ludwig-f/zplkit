import type { Metadata } from "next";
import PlaygroundLoader from "@/playground/PlaygroundLoader";

export const metadata: Metadata = {
  title: "Playground",
  description:
    "Write zplkit code in TypeScript and JSX and see the label as you type. Everything runs in your browser.",
};

export default function PlaygroundPage() {
  return <PlaygroundLoader />;
}
