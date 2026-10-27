import type { ReactNode } from "react";

type TypeNode = {
  description?: ReactNode;
  type: ReactNode;
  typeDescription?: ReactNode;
  typeDescriptionLink?: string;
  default?: ReactNode;
  required?: boolean;
  deprecated?: boolean;
};

/**
 * Properties of a type as one table with everything visible: name, type,
 * default and description. Takes the props fumadocs-typescript generates
 * for Fumadocs' collapsible TypeTable.
 */
export function TypeTable({ type }: { type: Record<string, TypeNode> }) {
  const entries = Object.entries(type);
  const hasDefaults = entries.some(([, node]) => node.default);
  return (
    <div className="not-prose my-5 overflow-x-auto rounded-md border border-rule-strong">
      <table className="w-full border-separate border-spacing-0 text-left text-[14px] leading-[1.5]">
        <thead>
          <tr>
            {["Property", "Type", hasDefaults && "Default", "Description"]
              .filter(Boolean)
              .map((label) => (
                <th
                  key={label as string}
                  className="border-b border-rule-strong bg-surface px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted"
                >
                  {label}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {entries.map(([name, node]) => (
            <tr key={name} className="align-top [&:last-child>td]:border-b-0">
              <td className="whitespace-nowrap border-b border-rule px-3 py-2.5">
                <code className="font-mono text-[13px] font-semibold text-ink">
                  {name}
                  {!node.required && <span className="text-muted">?</span>}
                </code>
              </td>
              <td className="border-b border-rule px-3 py-2.5 font-mono text-[13px] [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0">
                {node.typeDescriptionLink ? (
                  <a
                    href={node.typeDescriptionLink}
                    // The type keeps its code colors, so an underline marks the link
                    className="underline decoration-rule-strong underline-offset-[3px] hover:decoration-accent"
                  >
                    {node.type}
                  </a>
                ) : (
                  node.type
                )}
              </td>
              {hasDefaults && (
                <td className="whitespace-nowrap border-b border-rule px-3 py-2.5 font-mono text-[13px] text-muted">
                  {node.default ?? ""}
                </td>
              )}
              <td className="border-b border-rule px-3 py-2.5 text-ink-2 [&_p]:m-0">
                {node.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
