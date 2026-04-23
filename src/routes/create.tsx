import { createFileRoute, Link } from "@tanstack/react-router";
import { WizardProvider, useWizard } from "@/components/wizard/WizardContext";
import { StepProgress } from "@/components/wizard/StepProgress";
import { TokenInfoStep } from "@/components/wizard/TokenInfoStep";
import { SupplyStep } from "@/components/wizard/SupplyStep";
import { DetailsStep } from "@/components/wizard/DetailsStep";
import { Wordmark } from "@/components/brand/Wordmark";
import { useWallet, truncateAddress } from "@/components/wallet/WalletContext";
import { LogOut } from "lucide-react";

function WizardHeaderConnect() {
  const { wallet, openPicker, disconnect } = useWallet();
  if (!wallet) {
    return (
      <button
        onClick={openPicker}
        className="btn-primary rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow"
      >
        Connect Wallet
      </button>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] pl-3 pr-1 py-1 text-xs">
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
  );
}

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create Token — MemeMinting" },
      { name: "description", content: "Configure and mint your Solana SPL token in 3 steps." },
      { property: "og:title", content: "Create Token — MemeMinting" },
      { property: "og:description", content: "Configure and mint your Solana SPL token in 3 steps." },
    ],
  }),
  component: CreatePage,
});

function WizardBody() {
  const { step } = useWizard();
  return (
    <>
      {step === 1 && <TokenInfoStep />}
      {step === 2 && <SupplyStep />}
      {step === 3 && <DetailsStep />}
    </>
  );
}

function CreatePage() {
  return (
    <WizardProvider>
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
          <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-3">
            <Link to="/" className="inline-flex items-center" aria-label="MemeMinting home">
              <Wordmark size="md" />
            </Link>
            <WizardHeaderConnect />
          </div>
        </header>

        <main className="flex-1 px-4 py-8 md:py-12">
          <div className="mx-auto max-w-3xl space-y-8">
            <StepProgress />
            <div className="card-premium rounded-3xl p-5 sm:p-8 relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{ background: "var(--gradient-soft)" }}
              />
              <div className="relative">
                <WizardBody />
              </div>
            </div>
          </div>
        </main>
      </div>
    </WizardProvider>
  );
}
