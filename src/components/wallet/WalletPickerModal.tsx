import { useEffect } from "react";
import { X, Wallet, Download } from "lucide-react";
import { useWallet, type WalletKind } from "./WalletContext";

const wallets: { kind: WalletKind; label: string; subtitle: string; emoji: string }[] = [
  { kind: "phantom", label: "Phantom", subtitle: "Most popular Solana wallet", emoji: "👻" },
  { kind: "backpack", label: "Backpack", subtitle: "xNFT-native wallet", emoji: "🎒" },
];

export function WalletPickerModal() {
  const { isPickerOpen, closePicker, connect, isConnecting, detected } = useWallet();

  useEffect(() => {
    if (!isPickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePicker();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPickerOpen, closePicker]);

  if (!isPickerOpen) return null;

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
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-accent/80">Connect</div>
            <h3 className="mt-1 text-xl font-semibold tracking-tight">Choose a wallet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect a Solana wallet to mint your token.
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
            return (
              <button
                key={w.kind}
                type="button"
                disabled={isConnecting}
                onClick={() => void connect(w.kind).catch(() => {})}
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
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Download className="h-3.5 w-3.5" /> Install
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-[11px] text-muted-foreground text-center">
          By connecting you agree to the platform terms. We never request seed phrases.
        </p>
      </div>
    </div>
  );
}
