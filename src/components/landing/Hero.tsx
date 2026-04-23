import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Sparkles, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useWallet } from "@/components/wallet/WalletContext";

function scrollTo(hash: string) {
  document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
}

export function Hero() {
  // Hero animates in immediately on mount (above the fold)
  const [mounted, setMounted] = useState(false);
  const { wallet, openPicker } = useWallet();
  const navigate = useNavigate();
  const [pendingNavigate, setPendingNavigate] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  // Auto-navigate to /create once the wallet connects after user clicked the CTA
  useEffect(() => {
    if (pendingNavigate && wallet) {
      setPendingNavigate(false);
      void navigate({ to: "/create" });
    }
  }, [pendingNavigate, wallet, navigate]);
  const cls = (extra = "") => `reveal ${mounted ? "is-visible" : ""} ${extra}`;

  function handlePrimary() {
    if (wallet) {
      void navigate({ to: "/create" });
    } else {
      setPendingNavigate(true);
      openPicker();
    }
  }

  return (
    <section className="relative px-4 pt-28 pb-32 md:pt-36 md:pb-44 overflow-hidden">
      {/* Cinematic ambient layers */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 50% 0%, oklch(0.66 0.22 290 / 22%), transparent 65%), radial-gradient(ellipse 40% 35% at 80% 20%, oklch(0.78 0.13 195 / 14%), transparent 70%), radial-gradient(ellipse 35% 30% at 15% 25%, oklch(0.68 0.18 250 / 12%), transparent 70%)",
        }}
      />
      {/* Soft conic core glow behind content */}
      <div
        aria-hidden
        className="absolute left-1/2 top-[18%] -translate-x-1/2 -translate-y-1/2 h-[560px] w-[980px] max-w-[95vw] rounded-full blur-[110px] opacity-70 pointer-events-none"
        style={{ background: "var(--gradient-soft)" }}
      />
      {/* Subtle grid texture */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, oklch(1 0 0 / 100%) 1px, transparent 1px), linear-gradient(to bottom, oklch(1 0 0 / 100%) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 30%, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 30%, black 30%, transparent 75%)",
        }}
      />
      {/* Hairline top divider */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(0.66 0.22 290 / 35%), oklch(0.78 0.13 195 / 25%), transparent)",
        }}
      />

      <div className="relative mx-auto max-w-4xl text-center">
        <div
          className={cls(
            "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] pl-1.5 pr-4 py-1 text-[11px] uppercase tracking-[0.22em] text-foreground/80 backdrop-blur-xl shadow-glow-sm",
          )}
          style={{ transitionDelay: "0.05s" }}
        >
          <span
            className="inline-flex items-center justify-center h-6 w-6 rounded-full border border-white/15"
            style={{ background: "var(--gradient-soft)" }}
          >
            <Sparkles className="h-3 w-3 text-accent" />
          </span>
          <span>Premium Solana Token Creator</span>
          <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-accent/70 shadow-[0_0_8px_oklch(0.78_0.13_195/80%)]" />
          <span className="hidden sm:inline text-muted-foreground/80 normal-case tracking-normal text-[10px]">
            Mainnet
          </span>
        </div>

        <h1
          className={cls(
            "mt-8 text-[2.75rem] sm:text-[3.5rem] md:text-[5.5rem] lg:text-[6.25rem] font-semibold tracking-[-0.045em] leading-[0.98]",
          )}
          style={{ transitionDelay: "0.15s" }}
        >
          <span className="block text-foreground/95">Launch your Solana token</span>
          <span className="block mt-2 md:mt-3">
            in{" "}
            <span
              style={{
                letterSpacing: "-0.04em",
                fontFeatureSettings: '"ss01", "cv11", "kern", "ss03"',
                backgroundImage:
                  "linear-gradient(135deg, oklch(0.78 0.18 295) 0%, oklch(0.7 0.2 280) 35%, oklch(0.78 0.16 220) 70%, oklch(0.82 0.14 195) 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              minutes, not days
            </span>
          </span>

        </h1>

        <p
          className={cls(
            "mt-7 md:mt-8 text-base md:text-lg text-muted-foreground max-w-xl md:max-w-2xl mx-auto leading-relaxed",
          )}
          style={{ transitionDelay: "0.28s" }}
        >
          Create, configure, and mint SPL tokens with a clean 3-step wizard. Pay once,
          mint instantly, then hand off to Raydium for liquidity.
        </p>

        <div
          className={cls("mt-11 flex flex-col sm:flex-row gap-3 justify-center items-center")}
          style={{ transitionDelay: "0.4s" }}
        >
          <button
            type="button"
            onClick={handlePrimary}
            className="btn-primary group inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-gradient-primary px-8 py-4 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            {wallet ? "Continue to Wizard" : "Connect Wallet to Start"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <button
            onClick={() => scrollTo("#features")}
            className="btn-secondary inline-flex w-full sm:w-auto items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-8 py-4 text-sm font-semibold text-foreground/90 backdrop-blur-xl"
          >
            Learn More
          </button>
        </div>

        {/* Trust strip */}
        <div
          className={cls(
            "mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80",
          )}
          style={{ transitionDelay: "0.52s" }}
        >
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-accent/80" />
            Pay-then-mint
          </span>
          <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-white/15" />
          <span className="inline-flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-accent/80" />
            Instant on-chain
          </span>
          <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-white/15" />
          <span>Solana Mainnet</span>
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, transparent, var(--color-background))",
        }}
      />
    </section>
  );
}

