import Link from "next/link";
import type { ReactNode } from "react";
import { Label, inches, lint, mm, parse } from "@zplkit/core";
import { Code128, Label as LabelElement, Text, build } from "@zplkit/core/jsx";
import { renderLabel } from "@/lib/render-label";
import { highlight, highlightZpl } from "@/lib/highlight";
import { CodePanel } from "@/components/home/code-panel";
import { tools } from "@/components/tools";
import type { Tool } from "@/components/tools";
import { InstallBox } from "@/components/home/install-box";
import {
  orders,
  shippingLabel,
  shippingLabelSize,
} from "@/components/home/shipping-label";
import { LabelRoll } from "@/components/home/label-roll";

const order = { name: "Amara Okafor", tracking: "1ZK4F9W82034417" };

const builderSource = `import { Label, inches, mm } from "@zplkit/core";

const zpl = new Label({
  width: inches(4),
  height: inches(6),
  dpmm: 8,
})
  .text({
    position: { x: mm(5), y: mm(8) },
    text: "SHIP TO",
    font: { height: mm(3) },
  })
  .text({
    position: { x: mm(5), y: mm(13) },
    text: order.name,
    font: { height: mm(6) },
  })
  .code128({
    position: { x: mm(6), y: mm(112) },
    data: order.tracking,
    height: mm(22),
  })
  .toZPL();`;

const jsxSource = `import { Label, Text, Code128, build, inches, mm } from "@zplkit/core/jsx";

const zpl = build(
  <Label width={inches(4)} height={inches(6)} dpmm={8}>
    <Text x={mm(5)} y={mm(8)} height={mm(3)}>
      SHIP TO
    </Text>
    <Text x={mm(5)} y={mm(13)} height={mm(6)}>
      {order.name}
    </Text>
    <Code128 x={mm(6)} y={mm(112)} height={mm(22)}>
      {order.tracking}
    </Code128>
  </Label>
).toZPL();`;

/** The samples above, run for real, so the output shown can't drift from the code */
const builderZpl = new Label({ width: inches(4), height: inches(6), dpmm: 8 })
  .text({
    position: { x: mm(5), y: mm(8) },
    text: "SHIP TO",
    font: { height: mm(3) },
  })
  .text({
    position: { x: mm(5), y: mm(13) },
    text: order.name,
    font: { height: mm(6) },
  })
  .code128({
    position: { x: mm(6), y: mm(112) },
    data: order.tracking,
    height: mm(22),
  })
  .toZPL();

const jsxZpl = build(
  <LabelElement width={inches(4)} height={inches(6)} dpmm={8}>
    <Text x={mm(5)} y={mm(8)} height={mm(3)}>
      SHIP TO
    </Text>
    <Text x={mm(5)} y={mm(13)} height={mm(6)}>
      {order.name}
    </Text>
    <Code128 x={mm(6)} y={mm(112)} height={mm(22)}>
      {order.tracking}
    </Code128>
  </LabelElement>
).toZPL();

if (builderZpl !== jsxZpl) {
  throw new Error("The builder and JSX samples on the home page differ");
}

const lintSource = `import { readFileSync } from "node:fs";
import { parse, lint } from "@zplkit/core";

const zpl = readFileSync("labels/ship.zpl", "utf8");

for (const problem of lint(parse(zpl).commands)) {
  console.log(problem.rule, problem.message);
}`;

/** A label with three mistakes a printer wouldn't report */
const brokenLabel = `^XA
^PW812
^LL1218
^FO40,190^A0N,24,24^FDSHIP TO^FS
^FO40,222^A0N,48,44^FDAMARA OKAFOR^FS
^FO900,440^A0N,60,60^FDG1 4QE^FS
^BY12,3,180
^FO60,700^BCN,180,Y,N^FD1ZK4F9W82034417^FS`;

const lineOf = (offset: number) =>
  brokenLabel.slice(0, offset).split("\n").length;

const problems = lint(parse(brokenLabel).commands)
  .map((problem) => ({ ...problem, line: lineOf(problem.span?.start ?? 0) }))
  .sort((a, b) => a.line - b.line);

const previewSource = `import "@zplkit/preview/react";

<zpl-preview
  zpl={label}
  dpmm={8}
/>`;

const Eyebrow = ({ n, children }: { n: string; children: ReactNode }) => (
  <div className="flex items-center gap-2.5 font-mono text-xs font-semibold uppercase tracking-[0.06em]">
    <span className="rounded-[2px] bg-ink px-[7px] py-[3px] text-bg">{n}</span>
    <span className="text-muted">{children}</span>
  </div>
);

const Feature = ({
  n,
  packages,
  title,
  text,
  href,
  link,
  children,
}: {
  n: string;
  packages: string;
  title: string;
  text: ReactNode;
  href: string;
  link: string;
  children: ReactNode;
}) => (
  <article className="grid items-start gap-[clamp(24px,4cqi,56px)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr))]">
    <div className="flex max-w-[30em] flex-col gap-3.5 @[860px]:sticky @[860px]:top-24">
      <Eyebrow n={n}>{packages}</Eyebrow>
      <h2 className="text-[clamp(28px,3cqi,38px)] font-extrabold leading-[1.05] tracking-[-0.02em] [font-stretch:112%]">
        {title}
      </h2>
      <p className="text-pretty text-muted">{text}</p>
      <Link href={href} className="font-bold text-accent hover:underline">
        {link} →
      </Link>
    </div>
    <div className="flex min-w-0 flex-col gap-3">{children}</div>
  </article>
);

const Output = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <div className="min-w-0 rounded-md border border-dashed border-rule-strong bg-surface">
    <div className="border-b border-dashed border-rule-strong px-3.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
      {title}
    </div>
    {children}
  </div>
);

export default async function HomePage() {
  const [labelImage, builderHtml, jsxHtml, lintHtml, previewHtml] =
    await Promise.all([
      renderLabel(shippingLabel.toZPL(), shippingLabelSize),
      highlight(builderSource, "ts"),
      highlight(jsxSource, "tsx"),
      highlight(lintSource, "ts"),
      highlight(previewSource, "tsx"),
    ]);
  // The first label is in the page; the rest load as the roll prints them
  const rollSources = [
    labelImage,
    ...orders.slice(1).map((_, index) => `/hero-labels/${index + 1}.png`),
  ];
  const labelHeight = (width: number) =>
    Math.round(
      width * (shippingLabelSize.heightMm / shippingLabelSize.widthMm)
    );
  const labelAlt =
    "A 4 by 6 inch shipping label: sender, a priority mark, the recipient Amara Okafor in Glasgow, a routing code with a Data Matrix code, a Code 128 tracking barcode and a QR code";
  const rollAlt =
    "Shipping labels feeding out of a printer one after another, addressed to people in Glasgow, Düsseldorf, Warsaw, Copenhagen, Lyon, Istanbul and Madrid";

  return (
    <main className="@container w-full bg-bg text-ink">
      <section className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-[clamp(32px,5cqi,64px)] px-[clamp(20px,5cqi,64px)] pb-[clamp(40px,6cqi,80px)] pt-[clamp(36px,6cqi,88px)]">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-6">
          <div className="flex flex-wrap gap-2 font-mono text-xs font-medium uppercase leading-none tracking-[0.06em] text-muted">
            {["Open source", "TypeScript", "Node + browser"].map((tag) => (
              <span
                key={tag}
                className="rounded-[3px] border border-rule-strong px-2 py-1.5"
              >
                {tag}
              </span>
            ))}
          </div>
          <h1 className="text-balance text-display font-extrabold [font-stretch:118%]">
            Catch the label mistakes before the printer does.
          </h1>
          <p className="max-w-[34em] text-pretty text-[clamp(17px,1.6cqi,20px)] leading-[1.55] text-muted">
            zplkit is a TypeScript toolkit for ZPL, the language thermal label
            printers speak. Build labels in millimeters or dots, lint the ZPL
            you already have, and see every label dot for dot before it reaches
            the roll.
          </p>
          <InstallBox />
          <div className="flex flex-wrap gap-3">
            <Link
              href="/docs"
              className="inline-flex h-12 items-center rounded-md bg-accent px-[22px] font-bold text-on-accent transition-opacity hover:opacity-90"
            >
              Read the docs
            </Link>
            <Link
              href="/playground"
              className="inline-flex h-12 items-center rounded-md border-[1.5px] border-ink px-[22px] font-bold transition-colors hover:bg-surface"
            >
              Open the playground →
            </Link>
          </div>
        </div>

        <div className="flex min-w-0 flex-[1_1_340px] flex-col">
          <div className="relative flex h-[400px] justify-center overflow-hidden rounded-lg border border-rule pb-9 bg-platen @[640px]:h-[520px]">
            {/* The printer's exit: a soft shadow the label feeds out from under */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-black/25 to-transparent dark:from-black/60" />
            <div className="hidden @[640px]:block">
              <LabelRoll
                sources={rollSources}
                width={300}
                height={labelHeight(300)}
                alt={rollAlt}
              />
            </div>
            <div className="@[640px]:hidden">
              <LabelRoll
                sources={rollSources}
                width={230}
                height={labelHeight(230)}
                alt={rollAlt}
              />
            </div>
          </div>
        </div>
      </section>

      <div
        aria-hidden="true"
        className="mx-[clamp(20px,5cqi,64px)] rule-perf"
      />

      <section className="mx-auto flex max-w-[1280px] flex-col gap-[clamp(56px,7cqi,96px)] px-[clamp(20px,5cqi,64px)] py-[clamp(48px,7cqi,96px)]">
        <Feature
          n="01"
          packages="@zplkit/core"
          title="Build labels with JSX or typed calls."
          text="Place fields in millimeters or dots. zplkit converts them to the printer's resolution and escapes your data, and your editor catches a missing unit before a test print does."
          href="/docs/jsx"
          link="Building labels"
        >
          <CodePanel
            tabs={[
              { id: "JSX", code: jsxSource, html: jsxHtml },
              { id: "Methods", code: builderSource, html: builderHtml },
            ]}
          />
          <Output title="Output · ZPL">
            <div
              className="overflow-x-auto px-3.5 py-3 font-mono text-[13px] leading-[1.65] [&_pre]:!bg-transparent"
              dangerouslySetInnerHTML={{ __html: highlightZpl(builderZpl) }}
            />
          </Output>
        </Feature>

        <Feature
          n="02"
          packages="@zplkit/core"
          title="Lint the ZPL printers silently accept."
          text="Parse the ZPL you already ship and find what the printer won't tell you: values it clamps, fields it skips and labels that never print. Run it in tests or CI."
          href="/docs/linting"
          link="Lint rules"
        >
          <CodePanel
            title="check-labels.ts"
            tabs={[{ id: "check-labels.ts", code: lintSource, html: lintHtml }]}
          />
          <Output
            title={`Output · ${problems.length} problem${
              problems.length === 1 ? "" : "s"
            }`}
          >
            {problems.map((problem) => (
              <div
                key={`${problem.rule}-${problem.index}`}
                className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-2.5 gap-y-1 border-b border-rule px-3.5 py-2.5 last:border-b-0"
              >
                <span className="font-mono text-xs font-semibold leading-[1.8] text-muted">
                  L{problem.line}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={`flex items-center gap-2 font-mono text-[12.5px] font-semibold ${
                      problem.severity === "error" ? "text-err" : "text-warn"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`size-2 flex-none ${
                        problem.severity === "error"
                          ? "bg-err"
                          : "rotate-45 bg-warn"
                      }`}
                    />
                    {problem.severity} · {problem.rule}
                  </span>
                  <span className="text-sm leading-[1.45]">
                    {problem.message}
                  </span>
                </div>
              </div>
            ))}
          </Output>
        </Feature>

        <Feature
          n="03"
          packages="@zplkit/render · @zplkit/preview"
          title="See it dot for dot, anywhere."
          text={
            <>
              Render ZPL to PNG at 152, 203, 300 or 600 dpi, in Node or the
              browser, the way the printer draws it. Drop the{" "}
              <code className="font-mono text-[0.9em]">
                &lt;zpl-preview&gt;
              </code>{" "}
              element into React, Vue, Svelte or plain HTML.
            </>
          }
          href="/docs/rendering"
          link="Rendering"
        >
          <div className="grid min-w-0 gap-3 @[560px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <CodePanel
              title="order-label.tsx"
              tabs={[
                {
                  id: "order-label.tsx",
                  code: previewSource,
                  html: previewHtml,
                },
              ]}
            />
            <div className="flex items-center justify-center rounded-md border border-rule p-[18px] bg-platen">
              <img
                src={labelImage}
                alt={labelAlt}
                width={200}
                height={300}
                className="label-dim block rounded-md bg-paper shadow-label"
              />
            </div>
          </div>
        </Feature>
      </section>

      <section className="mx-[clamp(20px,5cqi,64px)] mb-[clamp(48px,6cqi,80px)] grid max-w-[1152px] overflow-hidden rounded-[10px] border-[1.5px] border-ink [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))] @[1280px]:mx-auto">
        <Link
          href="/docs/getting-started"
          className="flex flex-col gap-1.5 border-b-[1.5px] border-dashed border-rule-strong p-7 transition-colors hover:bg-surface @[700px]:border-b-0 @[700px]:border-r-[1.5px]"
        >
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.06em] text-muted">
            Start here
          </span>
          <span className="text-2xl font-extrabold [font-stretch:112%]">
            Quick start in the docs →
          </span>
          <span className="text-muted">
            Install, build your first label and render it to PNG.
          </span>
        </Link>
        <div className="flex flex-col gap-3 p-7">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.06em] text-muted">
            No install
          </span>
          {(Object.keys(tools) as Tool[]).map((id) => {
            const { href, name, tagline, Icon, tile } = tools[id];
            return (
              <Link
                key={id}
                href={href}
                className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-3.5 rounded-md border border-rule bg-raised p-3.5 transition-colors hover:border-rule-strong"
              >
                <span
                  className={`flex size-10 items-center justify-center rounded-md ${tile}`}
                >
                  <Icon className="size-[22px]" />
                </span>
                <span className="flex flex-col">
                  <span className="text-lg font-extrabold [font-stretch:108%]">
                    {name}
                  </span>
                  <span className="text-muted">{tagline}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <footer className="flex flex-wrap justify-between gap-x-8 gap-y-4 border-t border-rule px-[clamp(20px,5cqi,64px)] py-6 text-sm text-muted">
        <span>
          zplkit is independent open-source software, not affiliated with any
          printer manufacturer.
        </span>
        <nav className="flex gap-5">
          <Link href="/docs" className="hover:text-ink">
            Docs
          </Link>
          <Link href="/docs/commands" className="hover:text-ink">
            ZPL commands
          </Link>
          <Link href="/releases" className="hover:text-ink">
            Releases
          </Link>
          <a
            href="https://github.com/ludwig-f/zplkit"
            className="hover:text-ink"
          >
            GitHub
          </a>
          <a
            href="https://www.npmjs.com/package/@zplkit/core"
            className="hover:text-ink"
          >
            npm
          </a>
        </nav>
      </footer>
    </main>
  );
}
