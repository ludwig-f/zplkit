import { renderZpl } from "@zplkit/render";
import {
  orders,
  shippingLabelFor,
  shippingLabelSize,
} from "@/components/home/shipping-label";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return orders.map((_, index) => ({ file: `${index}.png` }));
}

/** A label the home page's hero prints, as a PNG made when the site is built */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  const order = orders[Number(file.replace(/\.png$/, ""))];
  if (!order) return new Response("Not found", { status: 404 });
  const [png] = await renderZpl(shippingLabelFor(order).toZPL(), {
    ...shippingLabelSize,
    grayscale: true,
  });
  return new Response(Buffer.from(png, "base64"), {
    headers: { "Content-Type": "image/png" },
  });
}
