import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { siteUrl } from "@/lib/shared";
import "./global.css";

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
});

// Unambiguous zero, O and l, which matter in ZPL like ^FO0,0
const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "zplkit", template: "%s | zplkit" },
  description:
    "Build, parse, lint and preview ZPL for Zebra label printers in TypeScript, with typed method calls or JSX.",
  // Data Matrix codes from lib/icon.ts; browsers pick the size for the screen
  icons: {
    icon: [16, 32].map((size) => ({
      url: `/icons/${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
    })),
    apple: "/icons/180.png",
  },
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
