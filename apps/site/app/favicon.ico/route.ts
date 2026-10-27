import { faviconIco } from "@/lib/icon";

export const dynamic = "force-static";

/** favicon.ico, made from ZPL when the site is built */
export async function GET() {
  return new Response(new Uint8Array(await faviconIco()), {
    headers: { "Content-Type": "image/x-icon" },
  });
}
