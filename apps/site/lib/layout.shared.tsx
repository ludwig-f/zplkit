import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Wordmark } from "@/components/wordmark";

/**
 * Options for Fumadocs' layouts. The header is the site's own
 * (components/site-header.tsx), with the links, search and theme switch.
 */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Wordmark className="text-[19px]" />,
    },
  };
}
