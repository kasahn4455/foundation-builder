import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type WalletKind = "phantom" | "solflare" | "backpack" | "view-only";

export type WalletInfo = {
  address: string;
  kind: WalletKind;
  /** When true, the wallet cannot sign transactions (watch-only). */
  viewOnly: boolean;
};

type WalletCtx = {
  wallet: WalletInfo | null;
  isConnecting: boolean;
  isPickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
  /** Simulated connect — frontend only for phase 2. */
  connect: (kind: WalletKind) => Promise<WalletInfo>;
  disconnect: () => void;
};

const Ctx = createContext<WalletCtx | null>(null);

/** Frontend-only deterministic-ish demo address per wallet kind. */
function makeDemoAddress(kind: WalletKind): string {
  const seed = `${kind}-${Date.now()}`;
  // Base58-ish characters, no 0/O/I/l
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let out = "";
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = 0; i < 44; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    out += chars[h % chars.length];
  }
  return out;
}

export function truncateAddress(addr: string, head = 4, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPickerOpen, setPickerOpen] = useState(false);

  const openPicker = useCallback(() => setPickerOpen(true), []);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  const connect = useCallback(async (kind: WalletKind) => {
    setIsConnecting(true);
    // Simulate provider handshake
    await new Promise((r) => setTimeout(r, 650));
    const info: WalletInfo = {
      address: makeDemoAddress(kind),
      kind,
      viewOnly: kind === "view-only",
    };
    setWallet(info);
    setIsConnecting(false);
    setPickerOpen(false);
    return info;
  }, []);

  const disconnect = useCallback(() => setWallet(null), []);

  const value = useMemo<WalletCtx>(
    () => ({ wallet, isConnecting, isPickerOpen, openPicker, closePicker, connect, disconnect }),
    [wallet, isConnecting, isPickerOpen, openPicker, closePicker, connect, disconnect],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used within WalletProvider");
  return v;
}
