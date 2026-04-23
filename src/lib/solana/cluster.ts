export type Cluster = "devnet" | "mainnet";

const PUBLIC_DEVNET_RPC = "https://api.devnet.solana.com";

declare global {
  interface Window {
    __SOLANA_RPC_CONFIG__?: {
      mainnetRpcUrl?: string;
    };
  }
}

export class MissingMainnetRpcError extends Error {
  constructor() {
    super(
      "Mainnet RPC is not configured. Add VITE_SOLANA_MAINNET_RPC_URL as a build secret or SOLANA_MAINNET_RPC_URL as a backend secret and reload the app.",
    );
    this.name = "MissingMainnetRpcError";
  }
}

function readRuntimeMainnetRpc(): string {
  if (typeof window === "undefined") return "";
  return window.__SOLANA_RPC_CONFIG__?.mainnetRpcUrl?.trim() || "";
}

/**
 * Returns the RPC URL for the given cluster.
 *
 * Mainnet (browser): prefers `VITE_SOLANA_MAINNET_RPC_URL`, then falls back to
 * a runtime-injected mainnet RPC from the server so preview environments can
 * still use the configured secret without touching devnet logic.
 *
 * Devnet: falls back to the public devnet endpoint (CORS-friendly).
 */
export function rpcForCluster(cluster: Cluster): string {
  if (cluster === "mainnet") {
    const configured = import.meta.env.VITE_SOLANA_MAINNET_RPC_URL;
    const buildUrl = configured ? String(configured).trim() : "";
    const runtimeUrl = readRuntimeMainnetRpc();
    const url = buildUrl || runtimeUrl;
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.info(
        "[solana] cluster=mainnet",
        "frontendRpcEnvPresent=", Boolean(buildUrl),
        "runtimeRpcPresent=", Boolean(runtimeUrl),
        "rpcHost=", url ? safeHost(url) : "(missing)",
      );
    }
    if (!url) throw new MissingMainnetRpcError();
    return url;
  }
  const configured = import.meta.env.VITE_SOLANA_DEVNET_RPC_URL;
  const url = (configured && String(configured).trim()) || PUBLIC_DEVNET_RPC;
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.info("[solana] cluster=devnet rpcHost=", safeHost(url));
  }
  return url;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(invalid-url)";
  }
}

/** Detects the “public mainnet RPC blocks browsers” 403 case for friendlier UI errors. */
export function isMainnetRpcAccessError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /403|Access forbidden|failed to get recent blockhash/i.test(msg);
}

export function explorerTxUrl(signature: string, cluster: Cluster): string {
  const suffix = cluster === "mainnet" ? "" : `?cluster=${cluster}`;
  return `https://solscan.io/tx/${signature}${suffix}`;
}

export function explorerTokenUrl(mint: string, cluster: Cluster): string {
  const suffix = cluster === "mainnet" ? "" : `?cluster=${cluster}`;
  return `https://solscan.io/token/${mint}${suffix}`;
}
