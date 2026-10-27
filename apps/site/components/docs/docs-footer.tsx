import Link from "next/link";
import { getReleases } from "@/lib/releases";
import { gitConfig } from "@/lib/shared";
import { Wordmark } from "@/components/wordmark";

const link = "font-semibold text-ink-2 hover:text-ink";

/** Under every docs page: releases, the release feed, GitHub and llms.txt */
export async function DocsFooter() {
  const latest = (await getReleases()).find((release) => release.dir === "zpl");
  return (
    <footer className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t-2 border-dashed border-rule-strong pt-5 text-[13.5px]">
      <Link href="/" aria-label="zplkit home" className="mr-auto text-ink">
        <Wordmark className="text-[15px]" />
      </Link>
      <Link href="/releases" className={`flex items-center gap-1.5 ${link}`}>
        Releases
        {latest && (
          <span className="rounded-[3px] border border-rule-strong px-1 font-mono text-[11px] font-medium text-muted">
            {latest.version}
          </span>
        )}
      </Link>
      <a href="/releases.xml" className={link}>
        Release feed
      </a>
      <a
        href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
        className={link}
      >
        GitHub
      </a>
      <a href="/llms.txt" className={link}>
        llms.txt
      </a>
    </footer>
  );
}
