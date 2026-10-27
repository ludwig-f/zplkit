import { notFound } from "next/navigation";
import data from "@/content/commands.json";
import { commandBySlug, commandSlug } from "@/lib/reference";
import { ogImage } from "@/lib/og";

export const revalidate = false;

const support = {
  yes: { text: "Supported by zplkit", color: "#1d6e3a" },
  partial: { text: "Partly supported by zplkit", color: "#8a5300" },
  no: undefined,
};

/** The link preview for a command's page: /og/reference/BC/image.png */
export async function GET(
  _req: Request,
  { params }: RouteContext<"/og/reference/[command]/image.png">
) {
  const { command: slug } = await params;
  const command = commandBySlug(slug);
  if (!command) notFound();
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
}

export function generateStaticParams() {
  return data.commands.map((command) => ({
    command: commandSlug(command.code),
  }));
}
