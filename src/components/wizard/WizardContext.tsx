import { createContext, useContext, useState, type ReactNode } from "react";
import {
  BASE_FEE_SOL as PRICING_BASE_FEE_SOL,
  ADDON_FEE_SOL as PRICING_ADDON_FEE_SOL,
  computeTotalFee,
} from "@/lib/pricing";

export type Cluster = "devnet" | "mainnet";

export type WizardState = {
  // Step 1
  tokenName: string;
  tokenSymbol: string;
  tokenLogo: File | null;
  tokenLogoPreview: string;
  // Step 2
  decimals: number;
  totalSupply: string;
  description: string;
  // Step 3
  socialsEnabled: boolean;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
  modifyCreator: boolean;
  customAddress: boolean;
  customAddressSuffix: string;
  revokeFreeze: boolean;
  revokeMint: boolean;
  revokeUpdate: boolean;
  // Network
  cluster: Cluster;
};

const initial: WizardState = {
  tokenName: "",
  tokenSymbol: "",
  tokenLogo: null,
  tokenLogoPreview: "",
  decimals: 9,
  totalSupply: "1000000000",
  description: "",
  socialsEnabled: false,
  website: "",
  twitter: "",
  telegram: "",
  discord: "",
  modifyCreator: false,
  customAddress: false,
  customAddressSuffix: "",
  revokeFreeze: false,
  revokeMint: true,
  revokeUpdate: true,
  // Public production default. Devnet remains internally supported (the
  // `Cluster` type and all cluster-aware code paths are unchanged) but the
  // UI no longer exposes a selector, so every public mint targets mainnet.
  cluster: "mainnet",
};

type Ctx = {
  state: WizardState;
  set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
  step: number;
  setStep: (s: number) => void;
  totalPrice: number;
};

const WizardCtx = createContext<Ctx | null>(null);

// Re-export from the single source of truth (src/lib/pricing.ts) so any other
// component that imports BASE_FEE_SOL/ADDON_FEE_SOL from here keeps working,
// but pricing math is never duplicated.
export const BASE_FEE_SOL = PRICING_BASE_FEE_SOL;
export const ADDON_FEE_SOL = PRICING_ADDON_FEE_SOL;

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WizardState>(initial);
  const [step, setStep] = useState(1);

  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  // SINGLE SOURCE OF TRUTH for the user-visible total. Backend recomputes the
  // exact same number from `selected_options` in createOrder/recomputeTotal —
  // any drift here would surface as a "Pricing mismatch" server error.
  const totalPrice = computeTotalFee({
    modifyCreator: state.modifyCreator,
    customAddress: state.customAddress,
    revokeFreeze: state.revokeFreeze,
    revokeMint: state.revokeMint,
    revokeUpdate: state.revokeUpdate,
  });

  return (
    <WizardCtx.Provider value={{ state, set, step, setStep, totalPrice }}>
      {children}
    </WizardCtx.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardCtx);
  if (!ctx) throw new Error("useWizard must be used within WizardProvider");
  return ctx;
}
