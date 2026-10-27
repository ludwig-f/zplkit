import { iconPng } from "@/lib/icon";

export const dynamic = "force-static";
export const dynamicParams = false;

/** Tab icons, and the Apple icon at 180 */
const sizes = [16, 32, 180];

export function generateStaticParams() {
  return sizes.map((size) => ({ file: `${size}.png` }));
}

/** An icon as a PNG, made from ZPL when the site is built */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  const size = Number(file.replace(/\.png$/, ""));
  if (!sizes.includes(size)) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(await iconPng(size)), {
    headers: { "Content-Type": "image/png" },
  });
}
