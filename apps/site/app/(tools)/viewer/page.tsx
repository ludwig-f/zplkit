import type { Metadata } from "next";
import ViewerLoader from "@/playground/ViewerLoader";

export const metadata: Metadata = {
  title: "ZPL viewer",
  description:
    "Paste or write ZPL and see the label as you type, with warnings for mistakes the printer won't report. Everything runs in your browser.",
};

export default function ViewerPage() {
  return <ViewerLoader />;
}
