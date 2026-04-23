import { Coins, ShieldCheck, Zap, Layers } from "lucide-react";
import { useReveal } from "@/hooks/use-reveal";

const features = [
  { icon: Coins, title: "SPL Token Mint", desc: "Standard Solana SPL tokens with full metadata support." },
  { icon: Zap, title: "Pay-Then-Mint", desc: "Transparent fees. Mint only happens after payment is verified." },
  { icon: ShieldCheck, title: "Revoke Authorities", desc: "Optionally revoke freeze, mint, and update authorities for trust." },
  { icon: Layers, title: "Raydium Handoff", desc: "Continue to Raydium to add liquidity and make your token tradable." },
];

export function Features() {
  const header = useReveal<HTMLDivElement>();
  const grid = useReveal<HTMLDivElement>();

  return (
    <section id="features" className="px-4 py-24 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div
          ref={header.ref}
          className={`reveal ${header.visible ? "is-visible" : ""} text-center max-w-2xl mx-auto`}
        >
          <div className="text-[11px] uppercase tracking-[0.2em] text-accent/80 mb-3">Features</div>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">Everything you need to launch</h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            A focused toolkit for creators who want to ship a token without the friction.
          </p>
        </div>

        <div
          ref={grid.ref}
          className={`reveal-stagger ${grid.visible ? "is-visible" : ""} mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4`}
        >
          {features.map((f) => (
            <div key={f.title} className="reveal-item card-premium rounded-2xl p-6 group">
              <div
                className="h-11 w-11 rounded-xl grid place-items-center mb-5 border border-white/10 shadow-glow-sm"
                style={{ background: "var(--gradient-soft)" }}
              >
                <f.icon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
