import { source } from "@/lib/source";
import { notFound } from "next/navigation";
import data from "@/content/commands.json";
import { getPageImageUrl } from "@/lib/shared";
import { OgLabel, OgTitle, ogImage } from "@/lib/og";

export const revalidate = false;

const support = {
  yes: { text: "Supported by zplkit", color: "#1d6e3a" },
  partial: { text: "Partly supported by zplkit", color: "#8a5300" },
  no: undefined,
};

/** A command's preview: its code very large, then its name */
const commandImage = (code: string) => {
  const command = data.commands.find((c) => c.code === code)!;
  const pill = support[command.support as keyof typeof support];

  return ogImage({
    section: `ZPL commands · ${command.category}`,
    title: (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: 150,
            lineHeight: 1,
            letterSpacing: "-0.03em",
          }}
        >
          {command.code}
        </div>
        <div
          style={{
            fontWeight: 800,
            fontSize: 60,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            maxWidth: 1000,
          }}
        >
          {command.name}
        </div>
        {pill && (
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              marginTop: 20,
              padding: "8px 20px",
              borderRadius: 999,
              background: pill.color,
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 24,
            }}
          >
            {pill.text}
          </div>
        )}
      </div>
    ),
  });
};

export async function GET(
  _req: Request,
  { params }: RouteContext<"/og/docs/[...slug]">
) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  if (page.type === "commands" && page.data.code) {
    return commandImage(page.data.code);
  }

  return ogImage({
    section:
      page.type === "commands"
        ? "ZPL commands"
        : page.slugs[0] === "api"
        ? "Docs · API"
        : "Docs",
    title: <OgTitle>{page.data.title}</OgTitle>,
    description: page.data.description,
    aside: await OgLabel(),
  });
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImageUrl(page).segments,
  }));
}
