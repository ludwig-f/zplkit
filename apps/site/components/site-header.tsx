"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { Menu, Moon, Search, Sun, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { gitConfig } from "@/lib/shared";
import { Wordmark } from "./wordmark";
import { tools } from "./tools";
import type { Tool } from "./tools";

const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/** Switches between light and dark; the icon follows the theme in CSS */
function ThemeButton({ label }: { label?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label={label ? undefined : "Switch theme"}
      className={cn(
        "flex items-center gap-2 text-ink-2 hover:text-ink",
        label ? "h-11 px-2 text-[15px] font-semibold" : "size-8 justify-center"
      )}
    >
      <Moon className="size-[17px] dark:hidden" aria-hidden="true" />
      <Sun className="hidden size-[17px] dark:block" aria-hidden="true" />
      {label}
    </button>
  );
}

/** The site's header: Docs and the two tools, then search, theme and GitHub */
function Header({ tool }: { tool?: boolean }) {
  const pathname = usePathname();
  const { setOpenSearch, hotKey } = useSearchContext();
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const active: "docs" | Tool | undefined = pathname.startsWith("/docs")
    ? "docs"
    : pathname.startsWith("/playground")
    ? "playground"
    : pathname.startsWith("/viewer")
    ? "viewer"
    : undefined;

  // The menu closes on navigation and on a click outside it
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  const navLink = (on: boolean) =>
    cn(
      "flex items-center gap-[7px] whitespace-nowrap px-2.5",
      tool ? "text-[13.5px]" : "text-[14.5px]",
      on ? "font-bold text-ink" : "font-semibold text-ink-2 hover:text-ink"
    );

  return (
    <header
      ref={header}
      className={cn(
        "sticky top-0 z-40 border-b border-rule bg-bg",
        tool ? "h-12 md:h-11" : "h-14"
      )}
    >
      {/* Desktop */}
      <div className="flex h-full items-stretch gap-6 px-5 max-md:hidden">
        <Link
          href="/"
          aria-label="zplkit home"
          className="flex items-center text-ink"
        >
          <Wordmark className={tool ? "text-[17px]" : "text-[19px]"} />
        </Link>
        <nav className="flex items-stretch gap-0.5">
          <Link
            href="/docs"
            className={cn(
              navLink(active === "docs"),
              active === "docs" && "shadow-[inset_0_-2px_0_var(--zk-ink)]"
            )}
          >
            Docs
          </Link>
          {(Object.keys(tools) as Tool[]).map((id) => {
            const { href, short, Icon, text, bar } = tools[id];
            return (
              <Link
                key={id}
                href={href}
                className={cn(navLink(active === id), active === id && bar)}
              >
                <Icon className={cn("size-4", text)} />
                {short}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          {tool ? (
            <button
              type="button"
              onClick={() => setOpenSearch(true)}
              aria-label="Search docs"
              className="flex size-8 items-center justify-center text-ink-2 hover:text-ink"
            >
              <Search className="size-[17px]" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setOpenSearch(true)}
              className="flex h-[34px] w-[232px] items-center gap-2 rounded border border-rule-strong bg-raised pl-2.5 pr-2 text-[13.5px] text-muted hover:text-ink"
            >
              <Search className="size-[15px]" aria-hidden="true" />
              <span className="flex-1 text-left">Search docs</span>
              <kbd className="flex gap-0.5 rounded-[3px] border border-rule px-[5px] font-mono text-[11px] font-medium">
                {hotKey.map((key, index) => (
                  <span key={index}>{key.display}</span>
                ))}
              </kbd>
            </button>
          )}
          <ThemeButton />
          <a
            href={githubUrl}
            aria-label="zplkit on GitHub"
            className="flex size-8 items-center justify-center text-ink-2 hover:text-ink"
          >
            <GitHubIcon className="size-[17px]" />
          </a>
        </div>
      </div>

      {/* Phone */}
      <div className="flex h-full items-center gap-2.5 pl-4 pr-2 md:hidden">
        <Link
          href="/"
          aria-label="zplkit home"
          className="flex items-center text-ink"
        >
          <Wordmark className="text-[17px]" />
        </Link>
        {tool && active && active !== "docs" && (
          <span className="flex items-center gap-1.5 text-[14px]">
            <span className="text-rule-strong" aria-hidden="true">
              /
            </span>
            <span className="font-bold text-ink">{tools[active].name}</span>
          </span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setOpenSearch(true)}
          aria-label="Search docs"
          className="flex size-11 items-center justify-center text-ink-2"
        >
          <Search className="size-[19px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close the menu" : "Open the menu"}
          aria-expanded={open}
          className="flex size-11 items-center justify-center text-ink"
        >
          {open ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {open && (
        <div className="absolute inset-x-0 top-full flex flex-col border-b border-rule-strong bg-bg shadow-[0_24px_40px_-24px_rgb(0_0_0/0.4)] md:hidden">
          <div className="flex flex-col py-2">
            <Link
              href="/docs"
              className="flex h-12 items-center px-5 text-[17px] font-bold text-ink"
            >
              Docs
            </Link>
          </div>
          <div
            aria-hidden="true"
            className="mx-5 h-0.5 bg-[linear-gradient(90deg,var(--zk-rule-strong)_50%,transparent_0)] bg-size-[10px_2px]"
          />
          <div className="flex flex-col gap-2 px-4 pb-4 pt-3.5">
            <span className="px-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Tools
            </span>
            {(Object.keys(tools) as Tool[]).map((id) => {
              const { href, name, tagline, Icon, tile } = tools[id];
              return (
                <Link
                  key={id}
                  href={href}
                  className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-3 rounded-md border border-rule bg-raised p-3 text-ink"
                >
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-md",
                      tile
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[16px] font-extrabold [font-stretch:108%]">
                      {name}
                    </span>
                    <span className="text-[14px] leading-[1.4] text-muted">
                      {tagline}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-1 border-t border-rule px-3 pb-2.5 pt-1.5">
            <a
              href={githubUrl}
              className="flex h-11 items-center gap-2.5 px-2 text-[15px] font-semibold text-ink-2"
            >
              <GitHubIcon className="size-[18px]" />
              GitHub
            </a>
            <Link
              href="/releases"
              className="flex h-11 items-center px-2 text-[15px] font-semibold text-ink-2"
            >
              Releases
            </Link>
            <div className="flex-1" />
            <ThemeButton label="Theme" />
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteHeader() {
  return <Header />;
}

/** The header on the playground and viewer: shorter, with search as an icon */
export function ToolHeader() {
  return <Header tool />;
}
