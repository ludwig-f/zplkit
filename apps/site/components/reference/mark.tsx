type Support = "yes" | "partial" | "no";

/** Like a checkbox: checked, indeterminate for partly, or empty */
export function Mark({ value }: { value: Support }) {
  const box =
    "inline-flex size-[18px] items-center justify-center rounded-[4px]";
  if (value === "yes") {
    return (
      <span
        role="img"
        aria-label="Supported"
        className={`${box} bg-ok text-[12px] font-extrabold text-bg`}
      >
        ✓
      </span>
    );
  }
  if (value === "partial") {
    return (
      <span
        role="img"
        aria-label="Partly supported"
        className={`${box} bg-warn`}
      >
        <span className="h-[2px] w-2 rounded-full bg-bg" />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label="Not yet"
      className={`${box} border-[1.5px] border-rule-strong`}
    />
  );
}

export type { Support };
