import type { Metadata } from "next";
import ViewerLoader from "@/playground/ViewerLoader";

export const metadata: Metadata = {
  // What people search for, so the page is found by it
  title: "ZPL viewer: preview ZPL labels online",
  description:
    "Paste or write ZPL and see the label as you type, with warnings for mistakes the printer won't report. Everything runs in your browser.",
};

export default function ViewerPage() {
  return <ViewerLoader />;
}
