import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";

function scrollTo(hash: string) {
  document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
}

export function Hero() {
  return (
    <section className="relative px-4 pt-20 pb-24 md:pt-28 md:pb-32">
      <div className="mx-auto max-w-4xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Premium Solana Token Creator
        </div>

        <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
          Launch your Solana token <br className="hidden md:block" />
          in <span className="text-gradient">minutes, not days</span>
        </h1>

        <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
          Create, configure, and mint SPL tokens with a clean 3-step wizard. Pay once,
          mint instantly, then hand off to Raydium for liquidity.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/create"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            Connect Wallet to Start <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            onClick={() => scrollTo("#features")}
            className="inline-flex items-center justify-center rounded-full border border-border bg-card/60 px-6 py-3 text-sm font-semibold hover:bg-card transition"
          >
            Learn More
          </button>
        </div>
      </div>
    </section>
  );
}
