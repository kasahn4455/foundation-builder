import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PublicKey, type Transaction, type VersionedTransaction } from "@solana/web3.js";

export type WalletKind = "phantom" | "backpack";

export type SolanaProvider = {
  publicKey: PublicKey | null;
  isPhantom?: boolean;
  isBackpack?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  signAndSendTransaction?: <T extends Transaction | VersionedTransaction>(
    tx: T,
  ) => Promise<{ signature: string }>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export type WalletInfo = {
  address: string;
  kind: WalletKind;
};

type WalletCtx = {
  wallet: WalletInfo | null;
  provider: SolanaProvider | null;
  isConnecting: boolean;
  isPickerOpen: boolean;
  detected: { phantom: boolean; backpack: boolean };
  openPicker: () => void;
  closePicker: () => void;
  connect: (kind: WalletKind) => Promise<WalletInfo>;
  disconnect: () => void;
};

const Ctx = createContext<WalletCtx | null>(null);

export function truncateAddress(addr: string, head = 4, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

function getProvider(kind: WalletKind): SolanaProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    phantom?: { solana?: SolanaProvider };
    solana?: SolanaProvider;
    backpack?: SolanaProvider;
  };
  if (kind === "phantom") {
    const p = w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : null);
    return p ?? null;
  }
  if (kind === "backpack") {
    return w.backpack ?? null;
  }
  return null;
}

function installUrl(kind: WalletKind): string {
  return kind === "phantom" ? "https://phantom.app/" : "https://backpack.app/";
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [provider, setProvider] = useState<SolanaProvider | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [detected, setDetected] = useState({ phantom: false, backpack: false });

  // Detect installed wallets after mount (avoid SSR mismatch)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () =>
      setDetected({
        phantom: !!getProvider("phantom"),
        backpack: !!getProvider("backpack"),
      });
    check();
    const t = window.setTimeout(check, 400);
    return () => window.clearTimeout(t);
  }, []);

  const openPicker = useCallback(() => setPickerOpen(true), []);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  const connect = useCallback(async (kind: WalletKind) => {
    const p = getProvider(kind);
    if (!p) {
      window.open(installUrl(kind), "_blank", "noopener,noreferrer");
      throw new Error(`${kind} wallet not installed`);
    }
    setIsConnecting(true);
    try {
      const res = await p.connect();
      const address = res.publicKey.toBase58();
      const info: WalletInfo = { address, kind };
      setProvider(p);
      setWallet(info);
      setPickerOpen(false);
      return info;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    void provider?.disconnect?.().catch(() => {});
    setWallet(null);
    setProvider(null);
  }, [provider]);

  // Listen for wallet-side disconnects / account changes
  useEffect(() => {
    if (!provider?.on || !provider?.removeListener) return;
    const onDisconnect = () => {
      setWallet(null);
      setProvider(null);
    };
    const onAccountChanged = (...args: unknown[]) => {
      const pk = args[0] as PublicKey | null | undefined;
      if (!pk) return onDisconnect();
      setWallet((prev) =>
        prev ? { ...prev, address: pk.toBase58() } : prev,
      );
    };
    provider.on("disconnect", onDisconnect);
    provider.on("accountChanged", onAccountChanged);
    return () => {
      provider.removeListener?.("disconnect", onDisconnect);
      provider.removeListener?.("accountChanged", onAccountChanged);
    };
  }, [provider]);

  const value = useMemo<WalletCtx>(
    () => ({
      wallet,
      provider,
      isConnecting,
      isPickerOpen,
      detected,
      openPicker,
      closePicker,
      connect,
      disconnect,
    }),
    [wallet, provider, isConnecting, isPickerOpen, detected, openPicker, closePicker, connect, disconnect],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used within WalletProvider");
  return v;
}
