import { useEffect, useState } from "react";
import {
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Copy,
  ExternalLink,
  Check,
} from "lucide-react";
import { truncateAddress } from "@/components/wallet/WalletContext";

export type CreationStage =
  | "preparing"
  | "confirming"
  | "processing"
  | "creating"
  | "success"
  | "error"
  | "view-only-error";

const stageOrder: CreationStage[] = ["preparing", "confirming", "processing", "creating"];
const stageLabels: Record<Exclude<CreationStage, "success" | "error" | "view-only-error">, string> = {
  preparing: "Preparing Transaction",
  confirming: "Confirming",
  processing: "Processing",
  creating: "Creating Token",
};

export type CreationModalProps = {
  open: boolean;
  stage: CreationStage;
  mintAddress?: string;
  errorMessage?: string;
  tokenName?: string;
  tokenSymbol?: string;
  totalSol?: number;
  onClose: () => void;
  onRetry: () => void;
};

export function CreationModal({
  open,
  stage,
  mintAddress,
  errorMessage,
  tokenName,
  tokenSymbol,
  totalSol,
  onClose,
  onRetry,
}: CreationModalProps) {
  const [copied, setCopied] = useState(false);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc closes terminal states only
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (stage === "success" || stage === "error" || stage === "view-only-error") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, stage, onClose]);

  if (!open) return null;

  const isTerminal = stage === "success" || stage === "error" || stage === "view-only-error";

  async function copyMint() {
    if (!mintAddress) return;
    try {
      await navigator.clipboard.writeText(mintAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  function openExplorer() {
    if (!mintAddress) return;
    window.open(`https://solscan.io/token/${mintAddress}`, "_blank", "noopener,noreferrer");
  }

  function openRaydium() {
    const url = mintAddress
      ? `https://raydium.io/liquidity/create-pool/?token=${mintAddress}`
      : "https://raydium.io/liquidity/create-pool/";
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center px-4 py-6 sm:py-10"
      role="dialog"
      aria-modal="true"
      aria-label="Token creation"
    >
      <button
        type="button"
        aria-label={isTerminal ? "Close" : "Working…"}
        onClick={() => isTerminal && onClose()}
        className="absolute inset-0 bg-background/85 backdrop-blur-md"
      />

      <div className="relative w-full max-w-lg card-premium rounded-3xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        {isTerminal && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="btn-secondary absolute right-4 top-4 h-9 w-9 inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04]"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Progress states */}
        {stage !== "success" && stage !== "error" && stage !== "view-only-error" && (
          <ProgressBody stage={stage} tokenName={tokenName} tokenSymbol={tokenSymbol} totalSol={totalSol} />
        )}

        {/* Success */}
        {stage === "success" && (
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full grid place-items-center bg-success/15 border border-success/30 shadow-[0_0_40px_-10px_oklch(0.74_0.18_160/55%)]">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <div className="mt-5 text-[11px] uppercase tracking-[0.2em] text-success/90">
              Mint successful
            </div>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight">
              {tokenName || "Your token"} is live
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Your token has been minted successfully. To make it tradable, continue to Raydium
              and create liquidity using your new token mint address.
            </p>

            {mintAddress && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Mint address
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="text-xs sm:text-sm font-mono text-foreground/90 break-all">
                    {mintAddress}
                  </code>
                </div>
              </div>
            )}

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                onClick={copyMint}
                className="btn-secondary inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold"
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy Mint Address"}
              </button>
              <button
                onClick={openExplorer}
                className="btn-secondary inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold"
              >
                <ExternalLink className="h-4 w-4" />
                View on Explorer
              </button>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                onClick={openRaydium}
                className="btn-primary inline-flex items-center justify-center gap-2 rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
              >
                Continue to Raydium <ExternalLink className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="btn-secondary inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* View-only wallet error */}
        {stage === "view-only-error" && (
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full grid place-items-center bg-accent/15 border border-accent/30">
              <Eye className="h-8 w-8 text-accent" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold tracking-tight">Watch-only wallet</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              The connected wallet is view-only and cannot sign transactions. Reconnect with a
              wallet that holds the keys to mint a token.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button
                onClick={onClose}
                className="btn-secondary inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-semibold"
              >
                Close
              </button>
              <button
                onClick={onRetry}
                className="btn-primary inline-flex items-center justify-center rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Generic error */}
        {stage === "error" && (
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full grid place-items-center bg-destructive/15 border border-destructive/30">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold tracking-tight">Mint failed</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              {errorMessage || "Something went wrong while creating your token. Please try again."}
            </p>
            {mintAddress && (
              <p className="mt-2 text-xs text-muted-foreground">
                Reference: <code className="font-mono">{truncateAddress(mintAddress, 6, 6)}</code>
              </p>
            )}
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button
                onClick={onClose}
                className="btn-secondary inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-semibold"
              >
                Close
              </button>
              <button
                onClick={onRetry}
                className="btn-primary inline-flex items-center justify-center rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressBody({
  stage,
  tokenName,
  tokenSymbol,
  totalSol,
}: {
  stage: CreationStage;
  tokenName?: string;
  tokenSymbol?: string;
  totalSol?: number;
}) {
  const currentIdx = stageOrder.indexOf(stage as (typeof stageOrder)[number]);
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-accent/80">Working</div>
      <h3 className="mt-1 text-xl font-semibold tracking-tight">
        Creating {tokenName || "your token"}
        {tokenSymbol ? ` (${tokenSymbol})` : ""}
      </h3>
      {typeof totalSol === "number" && (
        <p className="mt-1 text-sm text-muted-foreground">
          Total: <span className="text-foreground font-semibold">{totalSol.toFixed(2)} SOL</span>
        </p>
      )}

      <ul className="mt-6 space-y-2">
        {stageOrder.map((s, i) => {
          const isDone = i < currentIdx;
          const isActive = i === currentIdx;
          return (
            <li
              key={s}
              className={[
                "flex items-center gap-3 rounded-2xl border px-4 py-3 transition",
                isActive
                  ? "border-primary/40 bg-primary/[0.06]"
                  : isDone
                    ? "border-success/30 bg-success/[0.05]"
                    : "border-white/5 bg-white/[0.02]",
              ].join(" ")}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-background/40">
                {isDone ? (
                  <Check className="h-4 w-4 text-success" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                )}
              </span>
              <span
                className={[
                  "text-sm",
                  isActive ? "text-foreground font-medium" : "text-muted-foreground",
                ].join(" ")}
              >
                {stageLabels[s]}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        Do not close this window until the process completes.
      </p>
    </div>
  );
}
