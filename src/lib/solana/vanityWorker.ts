/// <reference lib="webworker" />
/**
 * Vanity mint-keypair grinder (Web Worker).
 *
 * Brute-forces Solana ed25519 keypairs until the public key's base58
 * representation ends with the requested suffix. Runs entirely off the main
 * thread so the wizard UI stays responsive while grinding.
 *
 * Protocol (main thread → worker):
 *   { type: "start", suffix: string, caseSensitive: boolean,
 *     maxAttempts: number, maxElapsedMs: number }
 *   { type: "cancel" }
 *
 * Protocol (worker → main thread):
 *   { type: "progress", attempts: number, elapsedMs: number }
 *   { type: "found", secretKey: number[], publicKey: string, attempts: number, elapsedMs: number }
 *   { type: "failed", reason: "exhausted" | "timeout" | "cancelled",
 *     attempts: number, elapsedMs: number }
 *   { type: "error", message: string }
 *
 * `secretKey` is transferred as a plain number[] (64 bytes) to keep the
 * structured-clone payload simple. The main thread reconstructs a Keypair
 * via `Keypair.fromSecretKey(new Uint8Array(secretKey))`.
 */
import "@/lib/polyfills";
import { Keypair } from "@solana/web3.js";

type StartMsg = {
  type: "start";
  suffix: string;
  caseSensitive: boolean;
  maxAttempts: number;
  maxElapsedMs: number;
};
type CancelMsg = { type: "cancel" };
type InMsg = StartMsg | CancelMsg;

let cancelled = false;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener("message", (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  if (msg.type === "cancel") {
    cancelled = true;
    return;
  }
  if (msg.type === "start") {
    cancelled = false;
    void grind(msg);
  }
});

async function grind(opts: StartMsg): Promise<void> {
  const target = opts.caseSensitive ? opts.suffix : opts.suffix.toLowerCase();
  const start = Date.now();
  let attempts = 0;
  let lastReport = start;
  // Yield to the event loop every BATCH iterations so the worker can
  // process incoming "cancel" messages without us blocking forever.
  const BATCH = 1500;

  try {
    while (true) {
      for (let i = 0; i < BATCH; i++) {
        const kp = Keypair.generate();
        attempts++;
        const pk = kp.publicKey.toBase58();
        const tail = opts.caseSensitive ? pk : pk.toLowerCase();
        if (tail.endsWith(target)) {
          ctx.postMessage({
            type: "found",
            secretKey: Array.from(kp.secretKey),
            publicKey: pk,
            attempts,
            elapsedMs: Date.now() - start,
          });
          return;
        }
      }

      const now = Date.now();
      const elapsedMs = now - start;

      if (cancelled) {
        ctx.postMessage({ type: "failed", reason: "cancelled", attempts, elapsedMs });
        return;
      }
      if (attempts >= opts.maxAttempts) {
        ctx.postMessage({ type: "failed", reason: "exhausted", attempts, elapsedMs });
        return;
      }
      if (elapsedMs >= opts.maxElapsedMs) {
        ctx.postMessage({ type: "failed", reason: "timeout", attempts, elapsedMs });
        return;
      }

      // Throttled progress reports (~4/sec) to avoid swamping the main thread.
      if (now - lastReport >= 250) {
        ctx.postMessage({ type: "progress", attempts, elapsedMs });
        lastReport = now;
      }

      // Yield to the worker event loop so cancel/messages can be processed.
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  } catch (err) {
    ctx.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
