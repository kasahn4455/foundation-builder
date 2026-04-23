// Single source of truth for token-creation pricing (frontend + backend).
// CRITICAL: Never compare paid amounts against hardcoded numbers like 0.4.
// Always compute from selected_options via computeTotalFee().

export const BASE_FEE_SOL = 0.3;
export const ADDON_FEE_SOL = 0.1;

export type SelectedOptions = {
  modifyCreator: boolean;
  customAddress: boolean;
  revokeFreeze: boolean;
  revokeMint: boolean;
  revokeUpdate: boolean;
};

export const ADDON_KEYS: (keyof SelectedOptions)[] = [
  "modifyCreator",
  "customAddress",
  "revokeFreeze",
  "revokeMint",
  "revokeUpdate",
];

export function countAddons(opts: SelectedOptions): number {
  return ADDON_KEYS.reduce((n, k) => n + (opts[k] ? 1 : 0), 0);
}

export function computeAddonFee(opts: SelectedOptions): number {
  return round9(countAddons(opts) * ADDON_FEE_SOL);
}

export function computeTotalFee(opts: SelectedOptions): number {
  return round9(BASE_FEE_SOL + computeAddonFee(opts));
}

// Avoid floating-point drift like 0.30000000000000004
export function round9(n: number): number {
  return Math.round(n * 1e9) / 1e9;
}

export function solToLamports(sol: number): number {
  return Math.round(sol * 1_000_000_000);
}
