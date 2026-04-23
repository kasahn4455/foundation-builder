import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, LogOut, Eye } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { useWallet, truncateAddress } from "@/components/wallet/WalletContext";

type NavLink = { label: string; to?: string; hash?: string; href?: string };

const links: NavLink[] = [
  { label: "Create Token", to: "/create" },
  { label: "Create Liquidity", href: "https://raydium.io/liquidity/create-pool/" },
  { label: "Manage Liquidity", href: "https://raydium.io/portfolio/" },
  { label: "Learn", hash: "#faq" },
];

function scrollTo(hash: string) {
  const el = document.querySelector(hash);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { wallet, openPicker, disconnect } = useWallet();
  const navigate = useNavigate();

  function renderNavItem(l: NavLink, onClick?: () => void) {
    if (l.to) {
      return (
        <Link
          key={l.label}
          to={l.to}
          onClick={onClick}
          className="text-muted-foreground hover:text-foreground transition"
        >
          {l.label}
        </Link>
      );
    }
    if (l.href) {
      return (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
          className="text-muted-foreground hover:text-foreground transition"
        >
          {l.label}
        </a>
      );
    }
    return (
      <button
        key={l.label}
        onClick={() => {
          onClick?.();
          if (l.hash) scrollTo(l.hash);
        }}
        className="text-muted-foreground hover:text-foreground transition text-left"
      >
        {l.label}
      </button>
    );
  }

  function handleConnectClick() {
    if (wallet) {
      // Connected — go to wizard
      void navigate({ to: "/create" });
      return;
    }
    openPicker();
  }

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/60 border-b border-white/5">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="inline-flex items-center" aria-label="MemeMinting home">
          <Wordmark size="md" />
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          {links.map((l) => renderNavItem(l))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {wallet ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] pl-3 pr-1 py-1 text-xs">
              {wallet.viewOnly && <Eye className="h-3.5 w-3.5 text-accent" aria-label="View-only" />}
              <span className="font-mono text-foreground/90">{truncateAddress(wallet.address)}</span>
              <button
                onClick={disconnect}
                className="btn-secondary ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10"
                aria-label="Disconnect wallet"
                title="Disconnect"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectClick}
              className="btn-primary inline-flex items-center rounded-full bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow"
            >
              Connect Wallet
            </button>
          )}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden p-2 rounded-md hover:bg-muted"
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/5 bg-background/95 backdrop-blur-xl">
          <div className="px-4 py-3 flex flex-col gap-2">
            {links.map((l) => (
              <div key={l.label} className="py-1.5">
                {renderNavItem(l, () => setOpen(false))}
              </div>
            ))}
            {wallet ? (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-full border border-white/10 bg-white/[0.04] pl-3 pr-1 py-1.5 text-xs">
                <span className="inline-flex items-center gap-1.5 font-mono">
                  {wallet.viewOnly && <Eye className="h-3.5 w-3.5 text-accent" />}
                  {truncateAddress(wallet.address)}
                </span>
                <button
                  onClick={() => {
                    disconnect();
                    setOpen(false);
                  }}
                  className="btn-secondary inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5"
                >
                  <LogOut className="h-3.5 w-3.5" /> Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setOpen(false);
                  openPicker();
                }}
                className="btn-primary mt-2 inline-flex justify-center rounded-full bg-gradient-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
