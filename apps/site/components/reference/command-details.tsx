import data from "@/content/commands.json";
import details from "@/content/command-details.json";
import { apiFor } from "./api-links";
import { LiveExample } from "./live-example";

type Command = (typeof data.commands)[number];
type Param = {
  name: string;
  description: string;
  values?: string;
  default?: string;
};

type Details = {
  summary: string;
  syntax: string;
  params?: (Param | [string, string])[];
  example?: string;
};

/** Parameters as objects, whichever shape the data has */
const paramsOf = (info: Details): Param[] =>
  (info.params ?? []).map((param) =>
    Array.isArray(param) ? { name: param[0], description: param[1] } : param
  );

const detailsOf = (code: string) =>
  (details as unknown as Record<string, Details | undefined>)[code];

/** An example's image, rendered at build time, by command code */
type Examples = Record<
  string,
  { file: string; left: number; top: number; width: number; height: number }
>;

export function CommandDetails({
  command,
  image,
}: {
  command: Command;
  image?: Examples[string];
}) {
  const info = detailsOf(command.code);
  if (!info) return null;
  const params = paramsOf(info);
  const hasDefaults = params.some((param) => param.default);
  const api = command.support !== "no" ? apiFor[command.code] : undefined;
  const label =
    "scroll-mt-24 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted";
  return (
    <div className="@container flex flex-col gap-5 text-[14px] leading-[1.55]">
      <p className="max-w-[68ch] text-ink-2">{info.summary}</p>

      <div className="flex flex-col gap-1.5">
        <h2 id="format" className={label}>
          Format
        </h2>
        <code className="w-fit rounded-[3px] bg-code-inline px-1.5 py-0.5 font-mono text-[13px] text-ink">
          {info.syntax}
        </code>
      </div>

      {params.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h2 id="parameters" className={label}>
            Parameters
          </h2>
          <div className="max-w-[760px] overflow-x-auto rounded-md border border-rule">
            <table className="w-full border-separate border-spacing-0 text-left text-[13.5px]">
              <thead>
                <tr>
                  {["Parameter", "Description", hasDefaults && "Default"]
                    .filter(Boolean)
                    .map((heading) => (
                      <th
                        key={heading as string}
                        className={`border-b border-rule bg-raised px-3 py-1.5 ${label}`}
                      >
                        {heading}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {params.map((param) => (
                  <tr
                    key={param.name}
                    className="align-top [&:last-child>td]:border-b-0"
                  >
                    <td className="border-b border-rule px-3 py-1.5">
                      <code className="font-mono text-[13px] font-semibold text-ink">
                        {param.name}
                      </code>
                    </td>
                    <td className="border-b border-rule px-3 py-1.5 text-ink-2">
                      {param.description}
                      {param.values && (
                        <span className="block text-muted">{param.values}</span>
                      )}
                    </td>
                    {hasDefaults && (
                      <td className="border-b border-rule px-3 py-1.5 text-muted">
                        {param.default}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {info.example && (
        <LiveExample code={command.code} zpl={info.example} image={image} />
      )}

      {api && (
        <p id="in-zplkit" className="scroll-mt-24 text-ink-2">
          In zplkit:{" "}
          <a
            href={`/docs/api/label#${api.method.toLowerCase()}`}
            className="font-mono text-[13px] text-accent hover:underline"
          >
            label.{api.method}()
          </a>
          {api.element && (
            <>
              {" "}
              or{" "}
              <a
                href={`/docs/api/jsx#${api.element.toLowerCase()}`}
                className="font-mono text-[13px] text-accent hover:underline"
              >
                &lt;{api.element}&gt;
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}

export { detailsOf, paramsOf };
export type { Command, Details, Examples, Param };
