import { cn } from "@/lib/cn";

/**
 * The zplkit wordmark: "zpl" reversed out of an ink chip, then "kit". It's
 * type rather than an image, so it follows the text color and inverts with
 * the theme.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="zplkit"
      className={cn(
        "inline-flex items-center font-extrabold leading-none tracking-[-0.02em] [font-stretch:118%]",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="rounded-[0.12em] bg-current px-[0.13em] pb-[0.1em] pt-[0.04em]"
      >
        <span className="text-bg">zpl</span>
      </span>
      <span aria-hidden="true" className="pl-[0.05em]">
        kit
      </span>
    </span>
  );
}
