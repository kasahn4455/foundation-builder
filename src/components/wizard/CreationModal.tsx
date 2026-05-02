import { useEffect, useState } from "react";
import {
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
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
  | "error";

type ProgressStage = "preparing" | "confirming" | "processing" | "creating";
const stageOrder: ProgressStage[] = ["preparing", "confirming", "processing", "creating"];
const stageLabels: Record<ProgressStage, string> = {
  preparing: "Preparing Transaction",
  confirming: "Confirming",
  processing: "Processing",
  creating: "Creating Token",
};

export type CreationModalProps = {
  open: boolean;
  stage: CreationStage;
  mintAddress?: string;
  paymentSignature?: string;
  errorMessage?: string;
  tokenName?: string;
  tokenSymbol?: string;
  totalSol?: number;
  cluster?: "devnet" | "mainnet";
  /**
   * When the parent has committed a final immutable success snapshot, it
   * passes the precomputed explorer / Raydium URLs from that snapshot here.
   * The modal renders these directly instead of recomputing from `cluster` /
   * `mintAddress` so the completed page is byte-stable across re-renders.
   */
  explorerUrl?: string;
  raydiumUrl?: string;
  /** Live progress while the vanity-suffix grinder is running. */
  vanityProgress?: { attempts: number; elapsedMs: number };
  /** The suffix the user requested, shown in the progress UI. */
  vanitySuffix?: string;
  /** Cancels the in-flight vanity grinder. */
  onCancelVanity?: () => void;
  onClose: () => void;
  onRetry: () => void;
};

export function CreationModal({
  open,
  stage,
  mintAddress,
  paymentSignature,
  errorMessage,
  tokenName,
  tokenSymbol,
  totalSol,
  cluster = "devnet",
  explorerUrl,
  raydiumUrl,
  vanityProgress,
  vanitySuffix,
  onCancelVanity,
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
      if (stage === "success" || stage === "error") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, stage, onClose]);

  if (!open) return null;

  const isTerminal = stage === "success" || stage === "error";

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
    // Prefer the URL frozen into the parent's final success snapshot — that
    // way the link the user clicks on the completed page is byte-identical
    // to the one logged at finalization time, regardless of any subsequent
    // re-render of this modal.
    if (explorerUrl) {
      window.open(explorerUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (!mintAddress) return;
    const suffix = cluster === "mainnet" ? "" : `?cluster=${cluster}`;
    window.open(`https://solscan.io/token/${mintAddress}${suffix}`, "_blank", "noopener,noreferrer");
  }

  function openRaydium() {
    // Raydium's create-pool flow doesn't support pre-filling the token via
    // query string, so we just deep-link to the create-pool page and ask the
    // user to paste the mint address (which we already copied / show above).
    window.open(
      raydiumUrl ?? "https://raydium.io/liquidity/create-pool/",
      "_blank",
      "noopener,noreferrer",
    );
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
        {stage !== "success" && stage !== "error" && (
          <ProgressBody
            stage={stage}
            tokenName={tokenName}
            tokenSymbol={tokenSymbol}
            totalSol={totalSol}
            vanityProgress={vanityProgress}
            vanitySuffix={vanitySuffix}
            onCancelVanity={onCancelVanity}
          />
        )}

        {/* Success */}
        {stage === "success" && (
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full grid place-items-center bg-success/15 border border-success/30 shadow-[0_0_40px_-10px_oklch(0.74_0.18_160/55%)]">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <div className="mt-5 text-[11px] uppercase tracking-[0.2em] text-success/90">
              {cluster === "mainnet" ? "Mint successful" : "Devnet test mint successful"}
            </div>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight">
              {cluster === "mainnet"
                ? `${tokenName || "Your token"} is live`
                : `${tokenName || "Your token"} minted on devnet`}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              {cluster === "mainnet"
                ? "Your token has been minted on Solana mainnet. To make it tradable, copy the mint address below and paste it into Raydium's create-pool flow yourself to add liquidity (the address is not pre-filled)."
                : "Your token has been minted on Solana devnet for testing. Devnet tokens are not real and cannot be traded on Raydium — switch to Mainnet for a real launch."}
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

            {cluster === "mainnet" && (
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
            )}
            {cluster !== "mainnet" && (
              <div className="mt-3">
                <button
                  onClick={onClose}
                  className="btn-primary inline-flex w-full items-center justify-center rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        )}

        {/* Generic error */}
        {stage === "error" && (
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full grid place-items-center bg-destructive/15 border border-destructive/30">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold tracking-tight">
              {paymentSignature ? "Payment received — mint failed" : "Mint failed"}
            </h3>
            {paymentSignature ? (
              <>
                <p className="mt-2 text-sm font-medium text-foreground max-w-md mx-auto leading-relaxed">
                  Payment received. Token mint failed. You can retry minting without paying again.
                </p>
                <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Your payment is preserved on-chain. Retry will only rebuild the mint transaction — you will not be charged again.
                </p>
                {errorMessage && (
                  <p className="mt-2 text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Reason: {errorMessage}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                {errorMessage || "Something went wrong before any payment was made. Please try again."}
              </p>
            )}
            {paymentSignature && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Payment signature (preserved — you will not be charged again)
                </div>
                <code className="mt-1 block text-xs font-mono text-foreground/90 break-all">
                  {paymentSignature}
                </code>
              </div>
            )}
            {mintAddress && !paymentSignature && (
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
                {paymentSignature ? "Retry Mint (no extra charge)" : "Try Again"}
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
  vanityProgress,
  vanitySuffix,
  onCancelVanity,
}: {
  stage: CreationStage;
  tokenName?: string;
  tokenSymbol?: string;
  totalSol?: number;
  vanityProgress?: { attempts: number; elapsedMs: number };
  vanitySuffix?: string;
  onCancelVanity?: () => void;
}) {
  const currentIdx = stageOrder.indexOf(stage as (typeof stageOrder)[number]);
  const showVanity =
    stage === "preparing" && vanityProgress && vanitySuffix && vanitySuffix.length > 0;
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

      {showVanity && (
        <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/[0.06] p-4 text-left">
          <div className="text-[11px] uppercase tracking-[0.18em] text-accent/90">
            Searching vanity address
          </div>
          <p className="mt-1 text-sm">
            Looking for a mint address ending in{" "}
            <code className="font-mono text-foreground">{vanitySuffix}</code>…
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{vanityProgress!.attempts.toLocaleString()} attempts</span>
            <span>{(vanityProgress!.elapsedMs / 1000).toFixed(1)}s</span>
          </div>
          {onCancelVanity && (
            <button
              type="button"
              onClick={onCancelVanity}
              className="mt-3 inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold"
            >
              Cancel search
            </button>
          )}
        </div>
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
