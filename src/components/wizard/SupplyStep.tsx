import { Minus, Plus } from "lucide-react";
import { useWizard } from "./WizardContext";

export function SupplyStep() {
  const { state, set, setStep } = useWizard();

  const supplyNum = Number(state.totalSupply.replace(/[^0-9]/g, "")) || 0;
  const formatted = supplyNum.toLocaleString();
  const magnitude =
    supplyNum >= 1e12
      ? "Trillion"
      : supplyNum >= 1e9
        ? "Billion"
        : supplyNum >= 1e6
          ? "Million"
          : supplyNum >= 1e3
            ? "Thousand"
            : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Token Supply Configuration</h2>
        <span className="text-[11px] rounded-full border border-border bg-muted/40 px-2.5 py-1 text-muted-foreground">
          Solana Official
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Token Decimals</label>
          <span className="text-xs text-muted-foreground">Solana Standard: 9</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => set("decimals", Math.max(0, state.decimals - 1))}
            className="h-12 w-12 rounded-xl border border-border bg-muted/40 grid place-items-center hover:bg-muted transition"
            aria-label="Decrease"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="number"
            value={state.decimals}
            onChange={(e) => {
              const n = Math.max(0, Math.min(18, Number(e.target.value) || 0));
              set("decimals", n);
            }}
            className="input-dark text-center text-lg font-semibold"
          />
          <button
            onClick={() => set("decimals", Math.min(18, state.decimals + 1))}
            className="h-12 w-12 rounded-xl border border-border bg-muted/40 grid place-items-center hover:bg-muted transition"
            aria-label="Increase"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <p className="helper mt-2">
          Decimals determine the divisibility of your token. 9 decimals is the Solana standard for most tokens.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Total Supply</label>
          <span className="text-xs text-muted-foreground">Based on {state.decimals} decimals</span>
        </div>
        <input
          type="text"
          inputMode="numeric"
          value={state.totalSupply}
          onChange={(e) => set("totalSupply", e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="1000000000"
          className="input-dark"
        />
        <p className="helper mt-2">
          Total supply with decimals:{" "}
          <span className="text-success font-semibold">{formatted}</span> tokens
          {magnitude && <span className="text-muted-foreground"> ({magnitude})</span>}
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Token Description</label>
          <span className="text-xs text-muted-foreground">Stored in official token metadata</span>
        </div>
        <textarea
          value={state.description}
          onChange={(e) => set("description", e.target.value)}
          rows={4}
          placeholder="Describe your token..."
          className="input-dark resize-none"
        />
        <p className="helper mt-2">
          This description will be stored in your token's on-chain metadata and displayed in wallets and explorers.
        </p>
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2 sm:justify-between">
        <button
          onClick={() => setStep(1)}
          className="w-full sm:w-auto rounded-full border border-border bg-card/60 px-6 py-3 text-sm font-semibold hover:bg-card transition"
        >
          Previous Step
        </button>
        <button
          onClick={() => setStep(3)}
          className="w-full sm:w-auto rounded-full bg-gradient-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
