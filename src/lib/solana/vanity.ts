import { Keypair } from "@solana/web3.js";
// Vite ?worker import — the worker module is bundled separately and loaded
// off the main thread. Type comes from the Vite client types.
import VanityWorker from "./vanityWorker?worker";

/**
 * Base58 alphabet used by Solana public keys. Excludes 0, O, I, l to avoid
 * visual ambiguity. Suffix characters MUST come from this set, otherwise
 * grinding can never succeed.
 */
export const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_SET = new Set(BASE58_ALPHABET.split(""));

/** Hard cap on suffix length. 4 chars ≈ 11.3M attempts on average. */
export const MAX_SUFFIX_LENGTH = 4;

export type VanityValidationResult =
  | { ok: true; suffix: string }
  | { ok: false; reason: string };

/**
 * Validate a user-supplied vanity suffix. Rejects empty input, anything
 * longer than `MAX_SUFFIX_LENGTH`, and any character outside the Solana
 * base58 alphabet. The validated string is what gets sent into the worker —
 * raw user text is never passed to PublicKey/Keypair logic.
 */
export function validateVanitySuffix(raw: string): VanityValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "Suffix cannot be empty." };
  if (trimmed.length > MAX_SUFFIX_LENGTH) {
    return {
      ok: false,
      reason: `Suffix must be ${MAX_SUFFIX_LENGTH} characters or fewer.`,
    };
  }
  for (const ch of trimmed) {
    if (!BASE58_SET.has(ch)) {
      return {
        ok: false,
        reason: `"${ch}" is not a valid base58 character. Allowed: ${BASE58_ALPHABET}`,
      };
    }
  }
  return { ok: true, suffix: trimmed };
}

export type VanityProgress = {
  attempts: number;
  elapsedMs: number;
};

export type VanityFailure = {
  reason: "exhausted" | "timeout" | "cancelled" | "error";
  message: string;
  attempts: number;
  elapsedMs: number;
};

export type VanityHandle = {
  /** Resolves with the matching keypair, or rejects with a `VanityFailure`. */
  promise: Promise<Keypair>;
  /** Stop the grinder. The promise will reject with `reason: "cancelled"`. */
  cancel: () => void;
};

export type GrindOptions = {
  suffix: string;
  caseSensitive?: boolean;
  /** Hard cap on attempts (default 8M ~ enough for a 4-char base58 suffix). */
  maxAttempts?: number;
  /** Hard cap on wall-clock time (default 3 minutes). */
  maxElapsedMs?: number;
  onProgress?: (p: VanityProgress) => void;
};

const DEFAULT_MAX_ATTEMPTS = 8_000_000;
const DEFAULT_MAX_ELAPSED_MS = 180_000;

/**
 * Spawn a Web Worker that grinds Solana keypairs until the public key
 * (base58) ends with `suffix`. Returns a handle with a cancellable promise.
 *
 * The returned `Keypair` IS the real mint keypair to be used in the actual
 * mint transaction — caller passes it to `mintToken({ mintKeypair })`.
 */
export function grindVanityMintKeypair(opts: GrindOptions): VanityHandle {
  const validation = validateVanitySuffix(opts.suffix);
  if (!validation.ok) {
    return {
      promise: Promise.reject(
        Object.assign(new Error(validation.reason), {
          reason: "error" as const,
          attempts: 0,
          elapsedMs: 0,
        }),
      ),
      cancel: () => {},
    };
  }

  const worker = new VanityWorker();
  let settled = false;

  const promise = new Promise<Keypair>((resolve, reject) => {
    const cleanup = () => {
      worker.terminate();
    };

    worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as
        | { type: "progress"; attempts: number; elapsedMs: number }
        | { type: "found"; secretKey: number[]; publicKey: string; attempts: number; elapsedMs: number }
        | { type: "failed"; reason: "exhausted" | "timeout" | "cancelled"; attempts: number; elapsedMs: number }
        | { type: "error"; message: string };

      if (msg.type === "progress") {
        opts.onProgress?.({ attempts: msg.attempts, elapsedMs: msg.elapsedMs });
        return;
      }
      if (msg.type === "found") {
        if (settled) return;
        settled = true;
        cleanup();
        const kp = Keypair.fromSecretKey(new Uint8Array(msg.secretKey));
        resolve(kp);
        return;
      }
      if (msg.type === "failed") {
        if (settled) return;
        settled = true;
        cleanup();
        const human =
          msg.reason === "timeout"
            ? `Could not find a matching address within the time limit (${Math.round(msg.elapsedMs / 1000)}s, ${msg.attempts.toLocaleString()} attempts). Try a shorter suffix.`
            : msg.reason === "exhausted"
              ? `Could not find a matching address within ${msg.attempts.toLocaleString()} attempts. Try a shorter suffix.`
              : "Address generation was cancelled.";
        reject(
          Object.assign(new Error(human), {
            reason: msg.reason,
            attempts: msg.attempts,
            elapsedMs: msg.elapsedMs,
          }),
        );
        return;
      }
      if (msg.type === "error") {
        if (settled) return;
        settled = true;
        cleanup();
        reject(
          Object.assign(new Error(msg.message), {
            reason: "error",
            attempts: 0,
            elapsedMs: 0,
          }),
        );
        return;
      }
    };

    worker.onerror = (ev) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        Object.assign(new Error(ev.message || "Vanity worker crashed"), {
          reason: "error",
          attempts: 0,
          elapsedMs: 0,
        }),
      );
    };

    worker.postMessage({
      type: "start",
      suffix: validation.suffix,
      caseSensitive: opts.caseSensitive ?? true,
      maxAttempts: opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      maxElapsedMs: opts.maxElapsedMs ?? DEFAULT_MAX_ELAPSED_MS,
    });
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      try {
        worker.postMessage({ type: "cancel" });
      } catch {
        /* worker may already be terminated */
      }
    },
  };
}
