// Solana Base58 alphabet (no 0, O, I, l)
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

/**
 * Light-weight Base58 + length sanity check for Solana addresses.
 * A real Solana public key Base58-encodes to 32-44 chars.
 */
export function isLikelySolanaAddress(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v.length < 32 || v.length > 44) return false;
  return BASE58_RE.test(v);
}

export function assertSolanaAddress(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is missing`);
  }
  const v = value.trim();
  if (!isLikelySolanaAddress(v)) {
    throw new Error(
      `${label} is not a valid Solana address (Base58, 32-44 chars).`,
    );
  }
  return v;
}
