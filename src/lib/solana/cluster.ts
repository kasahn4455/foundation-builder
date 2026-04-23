export type Cluster = "devnet" | "mainnet";

const PUBLIC_MAINNET_RPC = "https://api.mainnet-beta.solana.com";
const PUBLIC_DEVNET_RPC = "https://api.devnet.solana.com";

/**
 * Returns the RPC URL for the given cluster.
 *
 * Mainnet note: the public `api.mainnet-beta.solana.com` endpoint blocks
 * browser CORS requests with HTTP 403. For mainnet to work from the browser,
 * `VITE_SOLANA_MAINNET_RPC_URL` MUST be set to a browser-accessible RPC
 * (e.g. Helius, QuickNode, Triton, Alchemy). We still fall back to the public
 * URL so devnet/server paths keep working — the mint flow surfaces a clear
 * error if the call is rejected.
 */
export function rpcForCluster(cluster: Cluster): string {
  if (cluster === "mainnet") {
    const configured = import.meta.env.VITE_SOLANA_MAINNET_RPC_URL;
    const url = (configured && String(configured).trim()) || PUBLIC_MAINNET_RPC;
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.info("[solana] cluster=mainnet rpc=", url, "configured=", Boolean(configured));
    }
    return url;
  }
  const configured = import.meta.env.VITE_SOLANA_DEVNET_RPC_URL;
  return (configured && String(configured).trim()) || PUBLIC_DEVNET_RPC;
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
