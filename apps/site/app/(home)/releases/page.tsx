import type { Metadata } from "next";
import { getReleases } from "@/lib/releases";
import { ReleaseList } from "@/components/releases/release-list";

export const metadata: Metadata = {
  title: "Releases",
  description: "Release notes for every version of the zplkit packages.",
  alternates: { types: { "application/atom+xml": "/releases.xml" } },
};

export default async function ReleasesPage() {
  const releases = await getReleases();
  return (
    <main className="@container mx-auto w-full max-w-[1080px] px-[clamp(20px,5cqi,64px)] py-[clamp(36px,6cqi,72px)]">
      <div className="mb-10 flex max-w-[44em] flex-col gap-4">
        <h1 className="text-[clamp(34px,4cqi,44px)] font-extrabold leading-[1.05] tracking-[-0.02em] [font-stretch:112%]">
          Releases
        </h1>
        <p className="text-lede text-muted">
          What changed in each version of the zplkit packages, newest first.
        </p>
        <a
          href="/releases.xml"
          className="w-fit text-sm font-semibold text-accent hover:underline"
        >
          Follow new releases with the Atom feed
        </a>
      </div>
      <ReleaseList releases={releases} />
    </main>
  );
}
