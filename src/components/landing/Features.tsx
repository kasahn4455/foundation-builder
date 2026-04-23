import { Coins, ShieldCheck, Zap, Layers } from "lucide-react";

const features = [
  { icon: Coins, title: "SPL Token Mint", desc: "Standard Solana SPL tokens with full metadata support." },
  { icon: Zap, title: "Pay-Then-Mint", desc: "Transparent fees. Mint only happens after payment is verified." },
  { icon: ShieldCheck, title: "Revoke Authorities", desc: "Optionally revoke freeze, mint, and update authorities for trust." },
  { icon: Layers, title: "Raydium Handoff", desc: "Continue to Raydium to add liquidity and make your token tradable." },
];

export function Features() {
  return (
    <section id="features" className="px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">Everything you need to launch</h2>
          <p className="mt-3 text-muted-foreground">
            A focused toolkit for creators who want to ship a token without the friction.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="card-premium rounded-2xl p-6">
              <div className="h-10 w-10 rounded-xl bg-gradient-primary/10 grid place-items-center mb-4 shadow-glow">
                <f.icon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
