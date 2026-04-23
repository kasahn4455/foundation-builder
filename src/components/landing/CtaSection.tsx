import { Link } from "@tanstack/react-router";
import { useReveal } from "@/hooks/use-reveal";

export function CtaSection() {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <section className="px-4 py-24 md:py-28">
      <div
        ref={ref}
        className={`reveal ${visible ? "is-visible" : ""} mx-auto max-w-4xl card-premium rounded-3xl p-12 md:p-16 text-center relative overflow-hidden`}
      >
        <div
          className="absolute inset-0 opacity-60 pointer-events-none"
          style={{ background: "var(--gradient-soft)" }}
        />
        <div
          aria-hidden
          className="absolute -top-32 left-1/2 -translate-x-1/2 h-64 w-[600px] max-w-[90%] rounded-full blur-3xl opacity-40 pointer-events-none"
          style={{ background: "var(--gradient-primary)" }}
        />
        <div className="relative">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">Ready to launch your token?</h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Connect your wallet and walk through the wizard. No code required.
          </p>
          <Link
            to="/create"
            className="btn-primary mt-9 inline-flex items-center rounded-full bg-gradient-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            Create Your Token
          </Link>
        </div>
      </div>
    </section>
  );
}
