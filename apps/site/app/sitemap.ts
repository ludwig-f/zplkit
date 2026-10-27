import type { MetadataRoute } from "next";
import { source } from "@/lib/source";
import { siteUrl } from "@/lib/shared";

/** Every page, for search engines: the site and the docs, commands included */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${siteUrl}${path}`;
  return [
    { url: url("/"), priority: 1 },
    { url: url("/playground"), priority: 0.9 },
    { url: url("/viewer"), priority: 0.9 },
    { url: url("/releases"), priority: 0.5 },
    ...source.getPages().map((page) => ({
      url: url(page.url),
      priority: page.type === "commands" && page.slugs.length > 1 ? 0.6 : 0.8,
    })),
  ];
}
