import { source } from "@/lib/source";
import { notFound } from "next/navigation";
import { getPageImageUrl } from "@/lib/shared";
import { OgLabel, OgTitle, ogImage } from "@/lib/og";

export const revalidate = false;

export async function GET(
  _req: Request,
  { params }: RouteContext<"/og/docs/[...slug]">
) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  return ogImage({
    section: page.slugs[0] === "api" ? "Docs · API" : "Docs",
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
