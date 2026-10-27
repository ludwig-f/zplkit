import { source } from "@/lib/source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";
import { DocsSubnav } from "@/components/docs/subnav";
import { SiteHeader } from "@/components/site-header";

/**
 * Docs sit under the same header as the rest of the site. The sidebar only
 * holds the page tree, since the header already has the logo, links,
 * search and theme switch.
 */
export default function Layout({ children }: LayoutProps<"/docs">) {
  return (
    <HomeLayout {...baseOptions()} slots={{ header: SiteHeader }}>
      <DocsLayout
        tree={source.getPageTree()}
        searchToggle={{ enabled: false }}
        themeSwitch={{ enabled: false }}
        sidebar={{ collapsible: false }}
        slots={{ header: DocsSubnav }}
        containerProps={{
          className: "[--fd-banner-height:3.5rem] [--fd-docs-height:100dvh]",
        }}
      >
        {children}
      </DocsLayout>
    </HomeLayout>
  );
}
