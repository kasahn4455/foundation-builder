import { cn } from "@/lib/utils";

type WordmarkProps = {
  /** Visual size preset */
  size?: "sm" | "md" | "lg" | "xl";
  /** Optional extra classes */
  className?: string;
  /** When true, renders without the leading mark dot */
  compact?: boolean;
};

const sizeMap: Record<NonNullable<WordmarkProps["size"]>, string> = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl",
};

const dotSizeMap: Record<NonNullable<WordmarkProps["size"]>, string> = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
  lg: "h-2.5 w-2.5",
  xl: "h-3 w-3",
};

/**
 * MemeMinting brand wordmark.
 * Single source of truth — used in navbar, footer, wizard header, and modals.
 *
 * Typography: Inter, weight 600, tight tracking, custom feature settings
 * for a slightly bespoke feel. Two gradient halves split the brand:
 *   - "Meme"    → premium purple → blue
 *   - "Minting" → cyan → teal
 */
export function Wordmark({ size = "md", className, compact = false }: WordmarkProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 select-none font-semibold leading-none whitespace-nowrap",
        sizeMap[size],
        className,
      )}
      style={{
        // Slightly custom typographic feel: tight tracking, optical kerning,
        // and stylistic alternates from Inter for a bespoke wordmark look.
        letterSpacing: "-0.035em",
        fontFeatureSettings: '"ss01", "cv11", "kern", "ss03"',
      }}
      aria-label="MemeMinting"
    >
      {!compact && (
        <span
          aria-hidden
          className={cn(
            "inline-block rounded-full",
            dotSizeMap[size],
          )}
          style={{
            background:
              "linear-gradient(135deg, oklch(0.66 0.22 290), oklch(0.68 0.18 250) 50%, oklch(0.82 0.14 200))",
            boxShadow:
              "0 0 0 1px oklch(1 0 0 / 8%) inset, 0 0 12px oklch(0.66 0.22 290 / 55%), 0 0 20px oklch(0.78 0.13 195 / 35%)",
          }}
        />
      )}
      <span className="inline-flex items-baseline">
        <span
          style={{
            backgroundImage:
              "linear-gradient(135deg, oklch(0.78 0.18 295) 0%, oklch(0.7 0.2 280) 45%, oklch(0.7 0.18 250) 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Meme
        </span>
        <span
          style={{
            backgroundImage:
              "linear-gradient(135deg, oklch(0.82 0.14 210) 0%, oklch(0.82 0.14 195) 50%, oklch(0.78 0.13 180) 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Minting
        </span>
      </span>
    </span>
  );
}
