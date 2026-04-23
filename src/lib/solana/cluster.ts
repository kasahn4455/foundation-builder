export type Cluster = "devnet" | "mainnet";

const PUBLIC_DEVNET_RPC = "https://api.devnet.solana.com";

export class MissingMainnetRpcError extends Error {
  constructor() {
    super(
      "Mainnet RPC is not configured. Set VITE_SOLANA_MAINNET_RPC_URL to your Helius (or other) mainnet RPC URL and reload the app.",
    );
    this.name = "MissingMainnetRpcError";
  }
}

/**
 * Returns the RPC URL for the given cluster.
 *
 * Mainnet (browser): REQUIRES `VITE_SOLANA_MAINNET_RPC_URL`. We do NOT fall
 * back to the public endpoint because it blocks browser CORS with HTTP 403.
 * If missing, throws `MissingMainnetRpcError` so the UI can render a clear
 * message instead of a generic blockhash failure.
 *
 * Devnet: falls back to the public devnet endpoint (CORS-friendly).
 */
export function rpcForCluster(cluster: Cluster): string {
  if (cluster === "mainnet") {
    const configured = import.meta.env.VITE_SOLANA_MAINNET_RPC_URL;
    const url = configured ? String(configured).trim() : "";
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.info(
        "[solana] cluster=mainnet",
        "frontendRpcEnvPresent=", Boolean(url),
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
