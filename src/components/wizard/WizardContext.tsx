import { createContext, useContext, useState, type ReactNode } from "react";

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
};

type Ctx = {
  state: WizardState;
  set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
  step: number;
  setStep: (s: number) => void;
  totalPrice: number;
};

const WizardCtx = createContext<Ctx | null>(null);

export const BASE_FEE_SOL = 0.3;
export const ADDON_FEE_SOL = 0.1;

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WizardState>(initial);
  const [step, setStep] = useState(1);

  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const totalPrice =
    BASE_FEE_SOL +
    (state.modifyCreator ? ADDON_FEE_SOL : 0) +
    (state.customAddress ? ADDON_FEE_SOL : 0) +
    (state.revokeFreeze ? ADDON_FEE_SOL : 0) +
    (state.revokeMint ? ADDON_FEE_SOL : 0) +
    (state.revokeUpdate ? ADDON_FEE_SOL : 0);

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
