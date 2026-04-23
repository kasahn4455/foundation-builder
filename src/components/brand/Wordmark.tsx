import { cn } from "@/lib/utils";
import mascot from "@/assets/mememinting-mascot.png";

type WordmarkProps = {
  /** Visual size preset */
  size?: "sm" | "md" | "lg" | "xl";
  /** Optional extra classes */
  className?: string;
  /** When true, renders without the leading mascot */
  compact?: boolean;
};

const sizeMap: Record<NonNullable<WordmarkProps["size"]>, string> = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl",
};

const mascotSizeMap: Record<NonNullable<WordmarkProps["size"]>, string> = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-12 w-12",
};

/**
 * MemeMinting brand identity.
 * Single source of truth — used in navbar, footer, wizard header, and modals.
 *
 * Composition:
 *   - Mascot coin (purple → blue → teal gradient, smug grin, lightning ⚡ accent)
 *   - Wordmark "Meme" (purple → blue) + "Minting" (cyan → teal)
 *   - Inter, weight 600, tight tracking, custom feature settings for a
 *     slightly bespoke, logo-like feel.
 */
export function Wordmark({ size = "md", className, compact = false }: WordmarkProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 select-none font-semibold leading-none whitespace-nowrap",
        sizeMap[size],
        className,
      )}
      style={{
        letterSpacing: "-0.04em",
        fontFeatureSettings: '"ss01", "cv11", "kern", "ss03"',
      }}
      aria-label="MemeMinting"
    >
      {!compact && (
        <span
          aria-hidden
          className={cn(
            "relative inline-flex shrink-0 items-center justify-center",
            mascotSizeMap[size],
          )}
        >
          {/* Soft brand glow behind the mascot */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-full blur-md opacity-70"
            style={{
              background:
                "radial-gradient(circle, oklch(0.66 0.22 290 / 55%) 0%, oklch(0.78 0.13 195 / 25%) 55%, transparent 75%)",
            }}
          />
          <img
            src={mascot}
            alt=""
            width={96}
            height={96}
            loading="lazy"
            decoding="async"
            className="relative h-full w-full object-contain drop-shadow-[0_2px_6px_oklch(0_0_0/35%)]"
          />
        </span>
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
