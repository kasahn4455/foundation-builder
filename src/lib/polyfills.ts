// Browser polyfills required by Solana web3 / spl-token libraries.
// Safe to import multiple times; only assigns when running in a browser
// and when Buffer is not already present on the global object.
import { Buffer } from "buffer";

if (typeof window !== "undefined") {
  const g = globalThis as unknown as { Buffer?: typeof Buffer; global?: unknown };
  if (!g.Buffer) g.Buffer = Buffer;
  if (!g.global) g.global = globalThis;
}

export {};
