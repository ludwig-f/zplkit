import { commandExamples } from "@/lib/command-examples";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const examples = await commandExamples();
  return [...examples.values()].map(({ file }) => ({ file }));
}

/** An example from the reference, as a PNG made when the site is built */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  const examples = await commandExamples();
  const example = [...examples.values()].find((e) => e.file === file);
  if (!example) return new Response("Not found", { status: 404 });
  return new Response(example.png as BodyInit, {
    headers: { "Content-Type": "image/png" },
  });
}
