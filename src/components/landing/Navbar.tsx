import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { label: "Create Token", to: "/create" },
  { label: "Create Liquidity", hash: "#liquidity" },
  { label: "Manage Liquidity", hash: "#manage" },
  { label: "Learn", hash: "#faq" },
];

function scrollTo(hash: string) {
  const el = document.querySelector(hash);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/60 border-b border-white/5">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-tight text-gradient">
          MemeMinting
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          {links.map((l) =>
            l.to ? (
              <Link key={l.label} to={l.to} className="text-muted-foreground hover:text-foreground transition">
                {l.label}
              </Link>
            ) : (
              <button
                key={l.label}
                onClick={() => scrollTo(l.hash!)}
                className="text-muted-foreground hover:text-foreground transition"
              >
                {l.label}
              </button>
            )
          )}
        </nav>

        <Link
          to="/create"
          className="btn-primary hidden md:inline-flex items-center rounded-full bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow"
        >
          Connect Wallet
        </Link>

        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden p-2 rounded-md hover:bg-muted"
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl">
          <div className="px-4 py-3 flex flex-col gap-2">
            {links.map((l) =>
              l.to ? (
                <Link
                  key={l.label}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="py-2 text-sm text-muted-foreground"
                >
                  {l.label}
                </Link>
              ) : (
                <button
                  key={l.label}
                  onClick={() => {
                    setOpen(false);
                    scrollTo(l.hash!);
                  }}
                  className="py-2 text-left text-sm text-muted-foreground"
                >
                  {l.label}
                </button>
              )
            )}
            <Link
              to="/create"
              onClick={() => setOpen(false)}
              className="btn-primary mt-2 inline-flex justify-center rounded-full bg-gradient-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Connect Wallet
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
