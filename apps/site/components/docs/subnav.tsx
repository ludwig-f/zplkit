"use client";

import { useDocsLayout } from "fumadocs-ui/layouts/docs";
import { Menu } from "lucide-react";

/** On phones, a bar under the site header that opens the docs' sidebar */
export function DocsSubnav() {
  const { slots } = useDocsLayout();
  const Trigger = slots.sidebar.trigger;
  return (
    <div className="sticky top-(--fd-docs-row-1) z-30 flex h-(--fd-header-height) items-center border-b border-rule bg-bg/80 px-4 backdrop-blur-sm [grid-area:header] md:hidden max-md:[--fd-header-height:2.75rem]">
      <Trigger className="-ms-1.5 flex items-center gap-2 rounded px-1.5 py-1 text-sm font-semibold text-ink-2 hover:text-ink">
        <Menu className="size-4" aria-hidden="true" />
        Docs menu
      </Trigger>
    </div>
  );
}
