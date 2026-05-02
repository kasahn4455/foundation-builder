import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BASE_FEE_SOL, ADDON_FEE_SOL, round9 as sharedRound9 } from "@/lib/pricing";

const ClusterSchema = z.enum(["devnet", "mainnet"]);

const SelectedOptionsSchema = z.object({
  modifyCreator: z.boolean(),
  customAddress: z.boolean(),
  revokeFreeze: z.boolean(),
  revokeMint: z.boolean(),
  revokeUpdate: z.boolean(),
});

const CreateOrderInput = z.object({
  wallet_address: z.string().min(32).max(44),
  token_name: z.string().min(1).max(64),
  token_symbol: z.string().min(1).max(16),
  decimals: z.number().int().min(0).max(9),
  initial_supply: z.string().regex(/^\d+$/).max(40),
  cluster: ClusterSchema,
  base_fee_sol: z.number().min(0).max(10),
  addon_fee_sol: z.number().min(0).max(10),
  selected_options: SelectedOptionsSchema,
  total_fee_sol: z.number().min(0).max(20),
});

const VerifyPaymentInput = z.object({
  order_id: z.string().uuid(),
  wallet_address: z.string().min(32).max(44),
  payment_signature: z.string().min(32).max(128),
  cluster: ClusterSchema,
});

const SaveTokenResultInput = z.object({
  order_id: z.string().uuid(),
  payment_signature: z.string().min(32).max(128),
  token_signature: z.string().min(32).max(128),
  mint_address: z.string().min(32).max(44),
  ata_address: z.string().min(32).max(44),
  cluster: ClusterSchema,
});

function getPlatformWallet(cluster: "devnet" | "mainnet"): string {
  const raw =
    cluster === "mainnet"
      ? process.env.PLATFORM_WALLET_MAINNET
      : process.env.PLATFORM_WALLET_DEVNET;
  if (!raw) throw new Error(`Platform wallet for ${cluster} is not configured`);
  // Strip accidental quotes/whitespace, and a pasted "KEY = value" prefix.
  let w = raw.trim().replace(/^["']|["']$/g, "");
  const eq = w.indexOf("=");
  if (eq !== -1 && /^[A-Z_][A-Z0-9_]*\s*$/.test(w.slice(0, eq))) {
    w = w.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  // Validate before returning so a bad env var fails server-side, not in the wallet.
  try {
    new PublicKey(w);
  } catch {
    throw new Error(`Platform wallet for ${cluster} is not a valid Base58 address`);
  }
  return w;
}

function sanitizeRpcUrl(raw: string | undefined): string {
  if (!raw) return "";
  let v = raw.trim().replace(/^["']|["']$/g, "");
  const eq = v.indexOf("=");
  if (eq !== -1 && /^[A-Z_][A-Z0-9_]*$/.test(v.slice(0, eq).trim())) {
    v = v.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return v.startsWith("http://") || v.startsWith("https://") ? v : "";
}

function getRpc(cluster: "devnet" | "mainnet"): string {
  const envVar =
    cluster === "mainnet" ? process.env.SOLANA_MAINNET_RPC_URL : process.env.SOLANA_DEVNET_RPC_URL;
  const sanitized = sanitizeRpcUrl(envVar);
  const present = Boolean(sanitized);
  const url =
    sanitized ||
    (cluster === "mainnet"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com");
  let host = "(invalid-url)";
  try {
    host = new URL(url).host;
  } catch {}
  console.info(
    `[orders] backend cluster=${cluster} backendRpcEnvPresent=${present} rpcHost=${host}`,
  );
  return url;
}

// Re-derive total from selected_options server-side. This is the authoritative
// fee model — never trust the client's claimed total_fee_sol blindly.
//
// IMPORTANT: PAID_ADDON_KEYS must stay in lock-step with `ADDON_KEYS` in
// src/lib/pricing.ts.
const PAID_ADDON_KEYS = [
  "modifyCreator",
  "customAddress",
  "revokeFreeze",
  "revokeMint",
  "revokeUpdate",
] as const satisfies readonly (keyof z.infer<typeof SelectedOptionsSchema>)[];

function recomputeTotal(
  base: number,
  selected: z.infer<typeof SelectedOptionsSchema>,
): { addon: number; total: number } {
  const addonCount = PAID_ADDON_KEYS.reduce(
    (n, k) => n + (selected[k] ? 1 : 0),
    0,
  );
  const addon = round9(addonCount * ADDON_FEE_SOL);
  const total = round9(base + addon);
  return { addon, total };
}

function round9(n: number): number {
  return sharedRound9(n);
}

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => CreateOrderInput.parse(input))
  .handler(async ({ data }) => {
    // Authoritative recompute. Reject if client claims wrong total.
    if (data.base_fee_sol !== BASE_FEE_SOL) {
      throw new Error("Invalid base_fee_sol");
    }
    const { addon, total } = recomputeTotal(BASE_FEE_SOL, data.selected_options);
    if (round9(data.addon_fee_sol) !== addon || round9(data.total_fee_sol) !== total) {
      throw new Error("Pricing mismatch");
    }

    const recipient = getPlatformWallet(data.cluster);

    const insertRow = {
      wallet_address: data.wallet_address,
      amount_sol: total,
      status: "pending",
      token_name: data.token_name,
      token_symbol: data.token_symbol,
      decimals: data.decimals,
      // PostgREST accepts a string for NUMERIC columns; types are nominally number.
      initial_supply: data.initial_supply as unknown as number,
      cluster: data.cluster,
      base_fee_sol: BASE_FEE_SOL,
      addon_fee_sol: addon,
      selected_options: data.selected_options,
      total_fee_sol: total,
    };

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert(insertRow)
      .select()
      .single();

    if (error || !order) {
      console.error("createOrder insert failed:", error);
      throw new Error("Failed to create order");
    }

    return {
      order_id: order.id,
      recipient_wallet: recipient,
      amount_sol: total,
      base_fee_sol: BASE_FEE_SOL,
      addon_fee_sol: addon,
      selected_options: data.selected_options,
      total_fee_sol: total,
    };
  });

export const verifyPayment = createServerFn({ method: "POST" })
  .inputValidator((input) => VerifyPaymentInput.parse(input))
  .handler(async ({ data }) => {
    const { data: order, error: loadErr } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", data.order_id)
      .single();

    if (loadErr || !order) throw new Error("Order not found");
    if (order.cluster !== data.cluster) throw new Error("Cluster mismatch");
    if (order.wallet_address !== data.wallet_address) {
      throw new Error("Wallet mismatch");
    }

    // Idempotent re-verify: if this exact signature was already accepted,
    // do NOT charge again and do NOT re-hit the RPC. Return ok so the caller
    // can proceed straight to mint retry. This is the key guard that lets the
    // "payment ok but mint failed" retry flow finish without double charging.
    if (
      (order.status === "paid" || order.status === "minted") &&
      order.payment_signature === data.payment_signature
    ) {
      console.info("[orders] verifyPayment: idempotent re-verify", {
        order_id: order.id,
        status: order.status,
      });
      return { ok: true, order_id: order.id, already_verified: true as const };
    }
    if (order.status === "paid" || order.status === "minted") {
      // Different signature was already accepted for this order — refuse.
      throw new Error("Order already paid with a different signature");
    }

    const recipient = getPlatformWallet(data.cluster);
    const connection = new Connection(getRpc(data.cluster), "confirmed");
    const expectedLamports = Math.round(Number(order.total_fee_sol) * LAMPORTS_PER_SOL);

    // Fetch the canonical transaction form so account keys align exactly with
    // meta.preBalances/meta.postBalances. Verification below uses ONLY the
    // configured recipient wallet's balance increase; never sender/fee-payer delta.
    const tx = await connection.getTransaction(data.payment_signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) throw new Error("Transaction not found on-chain");
    if (tx.meta?.err) throw new Error("Transaction failed on-chain");

    const senderPk = new PublicKey(data.wallet_address);
    const recipientPk = new PublicKey(recipient);
    const recipientB58 = recipientPk.toBase58();
    const senderB58 = senderPk.toBase58();
    if (senderB58 === recipientB58) {
      throw new Error(
        "Platform wallet equals connected wallet — check PLATFORM_WALLET_* env (cannot pay yourself)",
      );
    }

    // Resolve the exact account-key list used by the balance arrays. For v0
    // transactions this includes loaded lookup-table addresses from metadata.
    const accountKeys = (tx.transaction.message as any).getAccountKeys({
      accountKeysFromLookups: tx.meta?.loadedAddresses ?? undefined,
    });
    const allKeys: string[] = Array.from({ length: accountKeys.length }, (_, i) =>
      accountKeys.get(i)?.toBase58?.() ?? "",
    );
    const recipientIdx = allKeys.findIndex((s) => s === recipientPk.toBase58());
    const senderIdx = allKeys.findIndex((s) => s === senderPk.toBase58());
    const pre = tx.meta?.preBalances ?? [];
    const post = tx.meta?.postBalances ?? [];
    const recipientPreBalance = recipientIdx >= 0 ? pre[recipientIdx] : undefined;
    const recipientPostBalance = recipientIdx >= 0 ? post[recipientIdx] : undefined;
    const receivedLamports =
      typeof recipientPreBalance === "number" && typeof recipientPostBalance === "number"
        ? recipientPostBalance - recipientPreBalance
        : NaN;

    console.info("[orders] verifyPayment audit", {
      order_id: order.id,
      total_fee_sol: order.total_fee_sol,
      expectedLamports,
      payment_signature: data.payment_signature,
      cluster: data.cluster,
      sender: senderB58,
      recipient: recipientB58,
      senderIdx,
      recipientIdx,
      recipientPreBalance: recipientPreBalance ?? null,
      recipientPostBalance: recipientPostBalance ?? null,
      receivedLamports,
    });

    if (senderIdx < 0) {
      console.warn("[orders] verifyPayment: sender not in tx accounts (continuing — may be loaded address)");
    }
    if (recipientIdx < 0) {
      console.warn("[orders] verifyPayment failed", {
        order_id: order.id,
        payment_signature: data.payment_signature,
        expectedLamports,
        sender: senderB58,
        recipient: recipientB58,
        recipientIdx,
        reason: "recipient-not-found",
      });
      throw new Error("Platform recipient not found in transaction");
    }
    if (!Number.isFinite(receivedLamports)) {
      console.warn("[orders] verifyPayment failed", {
        order_id: order.id,
        payment_signature: data.payment_signature,
        expectedLamports,
        sender: senderB58,
        recipient: recipientB58,
        recipientIdx,
        recipientPreBalance: recipientPreBalance ?? null,
        recipientPostBalance: recipientPostBalance ?? null,
        reason: "recipient-balance-unavailable",
      });
      throw new Error("Could not read platform recipient balance change");
    }

    if (receivedLamports < expectedLamports) {
      console.warn("[orders] verifyPayment underpayment decision", {
        order_id: order.id,
        expectedLamports,
        receivedLamports,
        decision: "REJECT",
      });
      throw new Error(
        `Underpayment: expected ${expectedLamports} lamports, got ${receivedLamports}`,
      );
    }

    // Conditional update guards against a concurrent verifier flipping the row
    // (status must still be 'pending'). If 0 rows are updated we re-read and
    // accept idempotently when the signature matches.
    const { data: updRows, error: updErr } = await supabaseAdmin
      .from("orders")
      .update({ status: "paid", payment_signature: data.payment_signature })
      .eq("id", order.id)
      .eq("status", "pending")
      .select("id");

    if (updErr) {
      console.error("[orders] verifyPayment update failed:", updErr);
      throw new Error("Failed to mark order paid");
    }
    if (!updRows || updRows.length === 0) {
      const { data: fresh } = await supabaseAdmin
        .from("orders")
        .select("status, payment_signature")
        .eq("id", order.id)
        .single();
      if (
        fresh &&
        (fresh.status === "paid" || fresh.status === "minted") &&
        fresh.payment_signature === data.payment_signature
      ) {
        return { ok: true, order_id: order.id, already_verified: true as const };
      }
      throw new Error("Failed to mark order paid (concurrent state change)");
    }

    console.info("[orders] verifyPayment ok", {
      order_id: order.id,
      lamports: receivedLamports,
      decision: "ACCEPT",
    });
    return { ok: true, order_id: order.id, already_verified: false as const };
  });

export const saveTokenResult = createServerFn({ method: "POST" })
  .inputValidator((input) => SaveTokenResultInput.parse(input))
  .handler(async ({ data }) => {
    const { data: order, error: loadErr } = await supabaseAdmin
      .from("orders")
      .select("id, status, payment_signature, cluster, token_signature, mint_address, ata_address")
      .eq("id", data.order_id)
      .single();

    if (loadErr || !order) throw new Error("Order not found");
    if (order.status === "minted") {
      const sameResult =
        order.payment_signature === data.payment_signature &&
        order.token_signature === data.token_signature &&
        order.mint_address === data.mint_address &&
        order.ata_address === data.ata_address &&
        order.cluster === data.cluster;
      if (sameResult) {
        console.info("[orders] saveTokenResult: idempotent duplicate ignored", {
          order_id: order.id,
          mint: data.mint_address,
          token_signature: data.token_signature,
        });
        return { ok: true, already_saved: true as const };
      }
      throw new Error("Order already minted with a different token result");
    }
    if (order.status !== "paid") throw new Error("Order is not paid");
    if (order.payment_signature !== data.payment_signature) {
      throw new Error("Payment signature mismatch");
    }
    if (order.cluster !== data.cluster) throw new Error("Cluster mismatch");

    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({
        status: "minted",
        token_signature: data.token_signature,
        mint_address: data.mint_address,
        ata_address: data.ata_address,
      })
      .eq("id", order.id);

    if (updErr) {
      console.error("saveTokenResult update failed:", updErr);
      throw new Error("Failed to save token result");
    }

    return { ok: true };
  });
