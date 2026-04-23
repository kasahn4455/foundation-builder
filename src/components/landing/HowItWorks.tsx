import { Link } from "@tanstack/react-router";

const steps = [
  { n: "01", title: "Connect Wallet", desc: "Connect Phantom or any Solana wallet to begin." },
  { n: "02", title: "Configure Token", desc: "Name, symbol, supply, decimals, socials and authorities." },
  { n: "03", title: "Pay & Mint", desc: "Pay the fee. We verify, then mint to the chain instantly." },
];

export function HowItWorks() {
  return (
    <section id="how" className="px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">How it works</h2>
          <p className="mt-3 text-muted-foreground">Three steps. No surprises.</p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="card-premium rounded-2xl p-6 relative overflow-hidden">
              <div className="text-5xl font-bold text-gradient opacity-80">{s.n}</div>
              <h3 className="mt-4 font-semibold text-lg">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            to="/create"
            className="inline-flex items-center rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            Get Started Now
          </Link>
        </div>
      </div>
    </section>
  );
}
