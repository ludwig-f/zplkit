import { getReleases } from "@/lib/releases";
import { siteUrl } from "@/lib/shared";

export const dynamic = "force-static";

const escape = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** A change's Markdown as HTML: bold, code and links */
const inlineHtml = (markdown: string) =>
  escape(markdown)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

/** An Atom feed of releases, for feed readers */
export async function GET() {
  const releases = await getReleases();
  const updated = releases[0]?.date ?? "2024-03-18";
  const entries = releases.map((release) => {
    const link = `${siteUrl}/releases#${release.dir}-${release.version}`;
    const html = release.sections
      .map(
        (section) =>
          `<h3>${escape(section.title)}</h3><ul>${section.items
            .map((item) => `<li>${inlineHtml(item)}</li>`)
            .join("")}</ul>`
      )
      .join("");
    return `  <entry>
    <id>${link}</id>
    <title>${escape(`${release.name} ${release.version}`)}</title>
    <link href="${link}"/>
    <updated>${release.date}T00:00:00Z</updated>
    <content type="html">${escape(html)}</content>
  </entry>`;
  });

  const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${siteUrl}/releases</id>
  <title>zplkit releases</title>
  <link href="${siteUrl}/releases"/>
  <link rel="self" href="${siteUrl}/releases.xml"/>
  <updated>${updated}T00:00:00Z</updated>
${entries.join("\n")}
</feed>
`;
  return new Response(feed, {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
  });
}
