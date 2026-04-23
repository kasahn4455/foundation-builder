import { Link } from "@tanstack/react-router";
import { useReveal } from "@/hooks/use-reveal";

const steps = [
  { n: "01", title: "Connect Wallet", desc: "Connect Phantom or any Solana wallet to begin." },
  { n: "02", title: "Configure Token", desc: "Name, symbol, supply, decimals, socials and authorities." },
  { n: "03", title: "Pay & Mint", desc: "Pay the fee. We verify, then mint to the chain instantly." },
];

export function HowItWorks() {
  const header = useReveal<HTMLDivElement>();
  const grid = useReveal<HTMLDivElement>();
  const cta = useReveal<HTMLDivElement>();

  return (
    <section id="how" className="px-4 py-24 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div
          ref={header.ref}
          className={`reveal ${header.visible ? "is-visible" : ""} text-center max-w-2xl mx-auto`}
        >
          <div className="text-[11px] uppercase tracking-[0.2em] text-accent/80 mb-3">Process</div>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">How it works</h2>
          <p className="mt-4 text-muted-foreground">Three steps. No surprises.</p>
        </div>

        <div
          ref={grid.ref}
          className={`reveal-stagger ${grid.visible ? "is-visible" : ""} mt-14 grid gap-4 md:grid-cols-3`}
        >
          {steps.map((s) => (
            <div key={s.n} className="reveal-item card-premium rounded-2xl p-7 relative overflow-hidden">
              <div className="text-6xl font-semibold text-gradient opacity-90 tracking-tight">{s.n}</div>
              <h3 className="mt-5 font-semibold text-lg tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        <div
          ref={cta.ref}
          className={`reveal ${cta.visible ? "is-visible" : ""} mt-12 flex justify-center`}
        >
          <Link
            to="/create"
            className="btn-primary inline-flex items-center rounded-full bg-gradient-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            Get Started Now
          </Link>
        </div>
      </div>
    </section>
  );
}
