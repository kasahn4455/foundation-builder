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

export type Platform = {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isInWalletBrowser: boolean;
  hasExtensionEnvironment: boolean;
};

type WalletCtx = {
  wallet: WalletInfo | null;
  provider: SolanaProvider | null;
  isConnecting: boolean;
  isPickerOpen: boolean;
  detected: { phantom: boolean; backpack: boolean };
  platform: Platform;
  openPicker: () => void;
  closePicker: () => void;
  connect: (kind: WalletKind) => Promise<WalletInfo>;
  disconnect: () => void;
  openInWalletBrowser: (kind: WalletKind) => void;
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

function detectPlatform(): Platform {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      isMobile: false,
      isIOS: false,
      isAndroid: false,
      isInWalletBrowser: false,
      hasExtensionEnvironment: false,
    };
  }
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobi|Mobile/i.test(ua);
  const isInWalletBrowser =
    /Phantom/i.test(ua) ||
    /Backpack/i.test(ua) ||
    !!(window as unknown as { phantom?: unknown }).phantom ||
    !!(window as unknown as { backpack?: unknown }).backpack;
  // Browser extensions only inject on desktop browsers; mobile Safari/Chrome don't load them.
  const hasExtensionEnvironment = !isMobile;
  return { isMobile, isIOS, isAndroid, isInWalletBrowser, hasExtensionEnvironment };
}

function buildDeeplink(kind: WalletKind): string {
  if (typeof window === "undefined") return "";
  const url = window.location.href;
  if (kind === "phantom") {
    // Phantom universal link to open the current page in Phantom's in-app browser.
    return `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(window.location.origin)}`;
  }
  // Backpack deeplink for in-app browser.
  return `https://backpack.app/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(window.location.origin)}`;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [provider, setProvider] = useState<SolanaProvider | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [detected, setDetected] = useState({ phantom: false, backpack: false });
  const [platform, setPlatform] = useState<Platform>(() => detectPlatform());

  // Detect installed wallets after mount (avoid SSR mismatch)
  useEffect(() => {
    if (typeof window === "undefined") return;
    setPlatform(detectPlatform());
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

  const openInWalletBrowser = useCallback((kind: WalletKind) => {
    if (typeof window === "undefined") return;
    const link = buildDeeplink(kind);
    console.info("[wallet] deeplink launched", { kind, link });
    // Use top-level navigation so iOS Safari honors the universal link.
    window.location.href = link;
  }, []);

  const connect = useCallback(async (kind: WalletKind) => {
    const plat = detectPlatform();
    const p = getProvider(kind);
    if (!p) {
      // On mobile (no extensions), don't claim the wallet isn't installed.
      // Hand off to the wallet's in-app browser via universal link instead.
      if (plat.isMobile && !plat.isInWalletBrowser) {
        console.info("[wallet] mobile browser fallback used", { kind });
        const link = buildDeeplink(kind);
        window.location.href = link;
        throw new Error(`Opening ${kind} mobile app…`);
      }
      console.info("[wallet] install prompt shown", { kind, platform: plat });
      window.open(installUrl(kind), "_blank", "noopener,noreferrer");
      throw new Error(`${kind} wallet not installed`);
    }
    console.info("[wallet] provider detected", {
      kind,
      path: plat.isInWalletBrowser ? "wallet-browser" : plat.isMobile ? "mobile-injected" : "desktop-extension",
    });
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
      platform,
      openPicker,
      closePicker,
      connect,
      disconnect,
      openInWalletBrowser,
    }),
    [wallet, provider, isConnecting, isPickerOpen, detected, platform, openPicker, closePicker, connect, disconnect, openInWalletBrowser],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used within WalletProvider");
  return v;
}
