import { createFileRoute, Link } from "@tanstack/react-router";
import { WizardProvider, useWizard } from "@/components/wizard/WizardContext";
import { StepProgress } from "@/components/wizard/StepProgress";
import { TokenInfoStep } from "@/components/wizard/TokenInfoStep";
import { SupplyStep } from "@/components/wizard/SupplyStep";
import { DetailsStep } from "@/components/wizard/DetailsStep";

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
          <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
            <Link to="/" className="text-xl font-bold text-gradient">
              MemeMinting
            </Link>
            <button className="rounded-full border border-border bg-card/60 px-4 py-2 text-xs font-medium hover:bg-card transition">
              Connect Wallet
            </button>
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
