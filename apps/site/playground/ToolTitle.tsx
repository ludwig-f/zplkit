import { tools } from "@/components/tools";
import type { Tool } from "@/components/tools";

/** The tool's icon, name and what it's for, at the start of the toolbar */
export default function ToolTitle({ tool }: { tool: Tool }) {
  const { name, tagline, Icon, tile } = tools[tool];
  return (
    <div className="tool-title">
      <span className={`tool-tile ${tile}`}>
        <Icon />
      </span>
      <h1>{name}</h1>
      <span className="tagline">{tagline}</span>
    </div>
  );
}
