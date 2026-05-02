import { useEffect, useState } from "react";
import { X, Wallet, Download, ExternalLink, ArrowRight, ArrowLeft } from "lucide-react";
import { useWallet, type WalletKind } from "./WalletContext";

const wallets: { kind: WalletKind; label: string; subtitle: string; emoji: string }[] = [
  { kind: "phantom", label: "Phantom", subtitle: "Most popular Solana wallet", emoji: "👻" },
  { kind: "backpack", label: "Backpack", subtitle: "xNFT-native wallet", emoji: "🎒" },
];

export function WalletPickerModal() {
  const { isPickerOpen, closePicker, connect, isConnecting, detected, platform, openInWalletBrowser } = useWallet();
  const [handoffKind, setHandoffKind] = useState<WalletKind | null>(null);

  useEffect(() => {
    if (!isPickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePicker();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPickerOpen, closePicker]);

  // Reset confirm step whenever modal closes
  useEffect(() => {
    if (!isPickerOpen) setHandoffKind(null);
  }, [isPickerOpen]);

  if (!isPickerOpen) return null;

  const handoffWallet = handoffKind ? wallets.find((w) => w.kind === handoffKind) : null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center px-4 py-6 sm:py-10"
      role="dialog"
      aria-modal="true"
      aria-label="Connect a wallet"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={closePicker}
        className="absolute inset-0 bg-background/80 backdrop-blur-md"
      />
      <div className="relative w-full max-w-md card-premium rounded-3xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        {handoffWallet ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-accent/80">Continue in {handoffWallet.label}</div>
                <h3 className="mt-1 text-xl font-semibold tracking-tight">One quick step</h3>
              </div>
              <button
                onClick={closePicker}
                aria-label="Close"
                className="btn-secondary -mr-1 -mt-1 h-9 w-9 inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex items-center justify-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl">
                🌐
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl">
                {handoffWallet.emoji}
              </span>
            </div>

            <p className="mt-5 text-sm text-foreground/90 text-center leading-relaxed">
              To connect on mobile, we’ll continue this page inside {handoffWallet.label}.
            </p>
            <p className="mt-2 text-xs text-muted-foreground text-center leading-relaxed">
              You’ll stay on the same page and pick up right where you left off — no progress is lost.
            </p>

            <div className="mt-6 space-y-2">
              <button
                type="button"
                onClick={() => {
                  openInWalletBrowser(handoffWallet.kind);
                }}
                className="btn-primary w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
              >
                Continue in {handoffWallet.label}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setHandoffKind(null)}
                className="btn-secondary w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs text-muted-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            </div>

            <p className="mt-4 text-[11px] text-muted-foreground text-center">
              We never request seed phrases. You can return to this browser anytime.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-accent/80">Connect</div>
                <h3 className="mt-1 text-xl font-semibold tracking-tight">Choose a wallet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {platform.isMobile && !platform.isInWalletBrowser
                    ? "Pick your wallet to continue this page inside its app."
                    : "Connect a Solana wallet to mint your token."}
                </p>
              </div>
              <button
                onClick={closePicker}
                aria-label="Close"
                className="btn-secondary -mr-1 -mt-1 h-9 w-9 inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {wallets.map((w) => {
                const installed = detected[w.kind];
                // On mobile browsers (not wallet browsers), extensions don't inject.
                // Treat as "needs handoff" rather than "not installed".
                const needsHandoff = platform.isMobile && !platform.isInWalletBrowser && !installed;
                const onClick = () => {
                  if (needsHandoff) {
                    setHandoffKind(w.kind);
                    return;
                  }
                  void connect(w.kind).catch(() => {});
                };
                return (
                  <button
                    key={w.kind}
                    type="button"
                    disabled={isConnecting}
                    onClick={onClick}
                    className="btn-secondary w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-left disabled:opacity-60"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-lg">
                      {w.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{w.label}</span>
                      <span className="block text-xs text-muted-foreground truncate">{w.subtitle}</span>
                    </span>
                    {installed ? (
                      <Wallet className="h-4 w-4 text-success" />
                    ) : needsHandoff ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <ExternalLink className="h-3.5 w-3.5" /> Continue
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Download className="h-3.5 w-3.5" /> Install
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {platform.isMobile && !platform.isInWalletBrowser ? (
              <p className="mt-4 text-[11px] text-muted-foreground text-center leading-relaxed">
                On mobile, wallets connect through their own in-app browser. We’ll continue this exact page there — you won’t lose your place.
              </p>
            ) : null}

            <p className="mt-3 text-[11px] text-muted-foreground text-center">
              By connecting you agree to the platform terms. We never request seed phrases.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
