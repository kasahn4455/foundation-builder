import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

function scrollTo(hash: string) {
  document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
}

export function Hero() {
  // Hero animates in immediately on mount (above the fold)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const cls = (extra = "") => `reveal ${mounted ? "is-visible" : ""} ${extra}`;

  return (
    <section className="relative px-4 pt-24 pb-28 md:pt-32 md:pb-36 overflow-hidden">
      <div
        aria-hidden
        className="absolute left-1/2 top-0 -translate-x-1/2 h-[480px] w-[900px] max-w-[90vw] rounded-full blur-3xl opacity-60 pointer-events-none"
        style={{ background: "var(--gradient-soft)" }}
      />
      <div className="relative mx-auto max-w-4xl text-center">
        <div
          className={cls(
            "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-md shadow-glow-sm",
          )}
          style={{ transitionDelay: "0.05s" }}
        >
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Premium Solana Token Creator
        </div>

        <h1
          className={cls("mt-7 text-[2.6rem] sm:text-5xl md:text-7xl font-semibold tracking-tight leading-[1.02]")}
          style={{ transitionDelay: "0.15s" }}
        >
          Launch your Solana token <br className="hidden md:block" />
          in <span className="text-gradient">minutes, not days</span>
        </h1>

        <p
          className={cls("mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed")}
          style={{ transitionDelay: "0.28s" }}
        >
          Create, configure, and mint SPL tokens with a clean 3-step wizard. Pay once,
          mint instantly, then hand off to Raydium for liquidity.
        </p>

        <div
          className={cls("mt-10 flex flex-col sm:flex-row gap-3 justify-center")}
          style={{ transitionDelay: "0.4s" }}
        >
          <Link
            to="/create"
            className="btn-primary group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            Connect Wallet to Start <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <button
            onClick={() => scrollTo("#features")}
            className="btn-secondary inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-7 py-3.5 text-sm font-semibold text-foreground/90 backdrop-blur-md"
          >
            Learn More
          </button>
        </div>
      </div>
    </section>
  );
}
