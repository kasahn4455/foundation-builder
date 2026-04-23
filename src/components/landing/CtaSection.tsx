import { Link } from "@tanstack/react-router";

export function CtaSection() {
  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-4xl card-premium rounded-3xl p-10 md:p-14 text-center relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{ background: "var(--gradient-soft)" }}
        />
        <div className="relative">
          <h2 className="text-3xl md:text-4xl font-bold">Ready to launch your token?</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Connect your wallet and walk through the wizard. No code required.
          </p>
          <Link
            to="/create"
            className="mt-7 inline-flex items-center rounded-full bg-gradient-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            Create Your Token
          </Link>
        </div>
      </div>
    </section>
  );
}
