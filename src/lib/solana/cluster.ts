export type Cluster = "devnet" | "mainnet";

export function rpcForCluster(cluster: Cluster): string {
  if (cluster === "mainnet") {
    return (
      import.meta.env.VITE_SOLANA_MAINNET_RPC_URL ||
      "https://api.mainnet-beta.solana.com"
    );
  }
  return (
    import.meta.env.VITE_SOLANA_DEVNET_RPC_URL ||
    "https://api.devnet.solana.com"
  );
}

export function explorerTxUrl(signature: string, cluster: Cluster): string {
  const suffix = cluster === "mainnet" ? "" : `?cluster=${cluster}`;
  return `https://solscan.io/tx/${signature}${suffix}`;
}

export function explorerTokenUrl(mint: string, cluster: Cluster): string {
  const suffix = cluster === "mainnet" ? "" : `?cluster=${cluster}`;
  return `https://solscan.io/token/${mint}${suffix}`;
}
