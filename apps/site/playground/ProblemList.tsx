/** A problem to list, with the line it's on when there's one to go to */
type ListedProblem = {
  severity: "error" | "warning";
  rule: string;
  message: string;
  line?: number;
};

/** Problems as a list, each with a button to its line when it has one */
export default function ProblemList<P extends ListedProblem>({
  problems,
  onSelect,
  clean = "No problems. This label prints as shown.",
}: {
  problems: P[];
  onSelect: (problem: P) => void;
  /** What to say when there are no problems */
  clean?: string;
}) {
  if (problems.length === 0) {
    return <p className="clean">{clean}</p>;
  }
  return (
    <ul>
      {problems.map((problem, index) => (
        <li key={index} className={`problem ${problem.severity}`}>
          {problem.line === undefined ? (
            <span className="line" aria-hidden="true" />
          ) : (
            <button
              type="button"
              className="line"
              onClick={() => onSelect(problem)}
              aria-label={`Go to line ${problem.line}`}
            >
              L{problem.line}
            </button>
          )}
          <div>
            <span className="rule">
              <span className="marker" aria-hidden="true" />
              {problem.severity} · {problem.rule}
            </span>
            <span className="message">{problem.message}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export type { ListedProblem };
