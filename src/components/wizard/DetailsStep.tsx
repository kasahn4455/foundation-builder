import { useEffect, useRef, useState } from "react";
import { Globe, Twitter, Send, MessageCircle } from "lucide-react";
import { useWizard } from "./WizardContext";
import { useWallet } from "@/components/wallet/WalletContext";
import { CreationModal, type CreationStage } from "./CreationModal";
import { createOrder, verifyPayment, saveTokenResult } from "@/server/orders.functions";
import { uploadTokenMetadata } from "@/server/metadata.functions";
import {
  sendPayment,
  mintToken,
  getWalletBalanceSol,
  generateMintKeypair,
} from "@/lib/solana/mint";
import { computeAddonFee, computeTotalFee, BASE_FEE_SOL } from "@/lib/pricing";
import {
  grindVanityMintKeypair,
  validateVanitySuffix,
  isLikelyMobile,
  MAX_SUFFIX_LENGTH,
  MAX_SUFFIX_LENGTH_MOBILE,
  MOBILE_MAX_ATTEMPTS,
  MOBILE_MAX_ELAPSED_MS,
  type VanityHandle,
} from "@/lib/solana/vanity";
import { Keypair } from "@solana/web3.js";

/** Read a File as raw base64 (without `data:` prefix) for server upload. */
async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return btoa(binary);
}

export function DetailsStep() {
  const { state, set, setStep, totalPrice } = useWizard();
  const { wallet, provider, openPicker } = useWallet();
  const [stage, setStage] = useState<CreationStage | null>(null);
  const [mintAddress, setMintAddress] = useState<string | undefined>();
  const [paymentSig, setPaymentSig] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [vanityProgress, setVanityProgress] = useState<{ attempts: number; elapsedMs: number } | null>(null);
  const vanityHandleRef = useRef<VanityHandle | null>(null);
  const [suffixError, setSuffixError] = useState<string | undefined>();
  /**
   * Synchronous re-entry guard for the Create Token click handler.
   *
   * `disabled={stage !== null && ...}` on the button is NOT enough on its own:
   * `runCreation` does async work (balance preflight, vanity grind) BEFORE the
   * first `setStage(...)` call, so the button stays visually enabled for that
   * window. A fast double-click — or a duplicate handler invocation from any
   * source — would otherwise race two `createOrder` + `sendPayment` calls and
   * trigger TWO Phantom payment popups for the same intent.
   *
   * A useRef flips synchronously inside the same tick as the click, so the
   * second invocation bails immediately. Released in `finally` so retries and
   * subsequent attempts still work.
   */
  const isRunningRef = useRef(false);
  const [pendingMint, setPendingMint] = useState<{
    orderId: string;
    paymentSignature: string;
    walletAddress: string;
    cluster: "devnet" | "mainnet";
    decimals: number;
    initialSupply: string;
    revokeFreeze: boolean;
    revokeMint: boolean;
    revokeUpdate: boolean;
    mintKeypair: Keypair;
    metadata: { name: string; symbol: string; uri: string };
    /**
     * When true, server-side payment verification has not yet succeeded for
     * this attempt (e.g. RPC hiccup right after the wallet sent SOL). On
     * retry we MUST re-run verifyPayment first — never createOrder/sendPayment
     * again — because verifyPayment is idempotent server-side for the same
     * (order_id, signature) pair and will not re-charge the user.
     */
    needsVerify?: boolean;
  } | null>(null);

  // Safety net: if the user navigates away mid-grind (or the component
  // unmounts for any reason), terminate the worker so it doesn't keep burning
  // CPU/battery in the background.
  useEffect(() => {
    return () => {
      vanityHandleRef.current?.cancel();
      vanityHandleRef.current = null;
    };
  }, []);

  /**
   * Map a raw mint-step error to user-facing text. Wallet-rejection during
   * the mint signature (AFTER payment was already taken) is the highest-risk
   * confusing case: the user has paid and now sees a raw "User rejected"
   * string and worries about a double-charge. Spell out that the payment is
   * preserved and Retry will not charge again.
   */
  function describeMintError(err: unknown, hasPreservedPayment: boolean): string {
    const msg = err instanceof Error ? err.message : "Mint transaction failed";
    const isWalletRejection =
      /user rejected|user denied|request rejected|rejected the request|cancell?ed|declined/i.test(msg) ||
      (err as { code?: number } | null)?.code === 4001;
    if (isWalletRejection) {
      return hasPreservedPayment
        ? "You cancelled the mint signature in your wallet. Your payment is preserved on-chain — click Retry Mint to sign again. You will not be charged again."
        : "You cancelled the mint signature in your wallet. No charge was made — click Try Again to retry.";
    }
    return msg;
  }

  async function completeMint(args: NonNullable<typeof pendingMint>) {
    setStage("creating");
    const mintRes = await mintToken({
      provider: provider!,
      payerAddress: args.walletAddress,
      cluster: args.cluster,
      decimals: args.decimals,
      initialSupply: args.initialSupply,
      revokeFreeze: args.revokeFreeze,
      revokeMint: args.revokeMint,
      revokeUpdate: args.revokeUpdate,
      mintKeypair: args.mintKeypair,
      metadata: args.metadata,
    });

    // Devnet free-test mode mints without an order — skip backend persistence.
    if (args.orderId !== "devnet-test") {
      await saveTokenResult({
        data: {
          order_id: args.orderId,
          payment_signature: args.paymentSignature,
          token_signature: mintRes.signature,
          mint_address: mintRes.mintAddress,
          ata_address: mintRes.ataAddress,
          cluster: args.cluster,
        },
      });
    }

    setMintAddress(mintRes.mintAddress);
    setPendingMint(null);
    setStage("success");
  }

  /**
   * Uploads the off-chain JSON metadata for a (possibly vanity-generated)
   * mint keypair. Must run BEFORE the on-chain mint tx because the
   * Token-2022 TokenMetadata extension needs the final HTTPS `uri` at
   * initialization time. The keypair is supplied by the caller so that the
   * vanity grinder can run first when Custom Token Address is enabled.
   */
  async function prepareMetadata(mintKeypair: Keypair): Promise<{
    mintKeypair: Keypair;
    metadata: { name: string; symbol: string; uri: string };
  }> {
    const mintAddr = mintKeypair.publicKey.toBase58();

    // Validate the logo BEFORE base64-encoding so a huge/wrong-type file
    // surfaces a clean error instead of OOM-ing the encoder or producing a
    // confusing zod failure on the server.
    let imageBase64: string | undefined;
    let imageMime: string | undefined;
    if (state.tokenLogo) {
      const MAX_LOGO_BYTES = 5 * 1024 * 1024; // matches server-side cap
      const ALLOWED_MIME = /^image\/(png|jpeg|jpg|gif|webp|svg\+xml)$/i;
      if (state.tokenLogo.size === 0) {
        throw new Error("Token logo file is empty. Please re-upload the image.");
      }
      if (state.tokenLogo.size > MAX_LOGO_BYTES) {
        throw new Error(
          `Token logo is too large (${(state.tokenLogo.size / 1024 / 1024).toFixed(2)} MB). Max 5 MB.`,
        );
      }
      if (!state.tokenLogo.type || !ALLOWED_MIME.test(state.tokenLogo.type)) {
        throw new Error(
          `Unsupported logo format "${state.tokenLogo.type || "unknown"}". Use PNG, JPG, GIF, WEBP, or SVG.`,
        );
      }
      imageBase64 = await fileToBase64(state.tokenLogo);
      imageMime = state.tokenLogo.type;
    }

    const socials = state.socialsEnabled
      ? {
          website: state.website || "",
          twitter: state.twitter || "",
          telegram: state.telegram || "",
          discord: state.discord || "",
        }
      : undefined;

    // Modify Creator Information
    // --------------------------------------------------------------
    // Token-2022's TokenMetadata extension does not have a Metaplex-style
    // creators array on-chain, so creator info is carried in the off-chain
    // JSON manifest (the closest standards-compliant mapping). The on-chain
    // `updateAuthority` is the cryptographic owner; this field is the
    // human-readable attribution wallets/explorers display.
    //
    //  - Not selected: default creator "MemeMinting" (project attribution).
    //  - Selected:     attribute the connected wallet as the creator.
    const creator = state.modifyCreator
      ? {
          name: state.tokenName.trim() || "Custom Creator",
          site: state.socialsEnabled ? state.website || "" : "",
          address: wallet?.address ?? "",
        }
      : {
          name: "MemeMinting",
          site: "https://mememinting.app",
          address: "",
        };

    console.info("[wizard] uploading metadata", {
      mint: mintAddr,
      hasLogo: Boolean(imageBase64),
      logoMime: imageMime,
      socialsEnabled: state.socialsEnabled,
      modifyCreator: state.modifyCreator,
    });

    let res: Awaited<ReturnType<typeof uploadTokenMetadata>>;
    try {
      res = await uploadTokenMetadata({
        data: {
          mint_address: mintAddr,
          name: state.tokenName.trim(),
          symbol: state.tokenSymbol.trim(),
          description: state.description || "",
          image_base64: imageBase64,
          image_mime: imageMime,
          external_url: socials?.website || "",
          socials,
          creator,
        },
      });
    } catch (uploadErr) {
      // Surface metadata failure with a clear, mint-stopping error. The outer
      // catch in runCreation will set stage="error" so the user sees this in
      // the modal — we DO NOT continue to mint with a placeholder URI.
      const reason = uploadErr instanceof Error ? uploadErr.message : "Unknown error";
      console.error("[wizard] METADATA_PREPARE_FAILED — mint will not proceed", {
        mint: mintAddr,
        reason,
      });
      throw new Error(
        `Could not prepare token metadata — mint was not started, and you have not been charged. ${reason}`,
      );
    }

    if (!res?.uri || !/^https:\/\//i.test(res.uri)) {
      console.error("[wizard] METADATA_URI_INVALID — mint will not proceed", {
        mint: mintAddr,
        res,
      });
      throw new Error(
        "Metadata upload returned an invalid URI. Mint was not started, and you have not been charged.",
      );
    }

    console.info("[wizard] METADATA_URI_READY", {
      mint: mintAddr,
      uri: res.uri,
      image_url: res.image_url,
    });

    return {
      mintKeypair,
      metadata: {
        name: state.tokenName.trim(),
        symbol: state.tokenSymbol.trim(),
        uri: res.uri,
      },
    };
  }

  async function runCreation() {
    setErrorMessage(undefined);
    setMintAddress(undefined);

    if (!wallet || !provider) {
      openPicker();
      return;
    }

    // Hoisted so BOTH the first-attempt path AND the retry path can build a
    // fresh mint keypair (random or vanity-grinded) on demand.
    const onMobile = isLikelyMobile();
    const generateMintKeypairForRun = async (): Promise<Keypair> => {
      if (!state.customAddress) return generateMintKeypair();
      setVanityProgress({ attempts: 0, elapsedMs: 0 });
      const handle = grindVanityMintKeypair({
        suffix: state.customAddressSuffix.trim(),
        caseSensitive: true,
        maxAttempts: onMobile ? MOBILE_MAX_ATTEMPTS : undefined,
        maxElapsedMs: onMobile ? MOBILE_MAX_ELAPSED_MS : undefined,
        onProgress: (p) => setVanityProgress(p),
      });
      vanityHandleRef.current = handle;
      try {
        const kp = await handle.promise;
        return kp;
      } finally {
        vanityHandleRef.current = null;
        setVanityProgress(null);
      }
    };

    // RETRY GUARD — if a previous attempt already paid + verified but the mint
    // tx failed, `pendingMint` is preserved. Retrying re-runs ONLY the mint
    // step (completeMint), never createOrder/sendPayment/verifyPayment, so
    // the user is never charged twice for the same token.
    if (pendingMint) {
      // Devnet free-test mode never made a real payment, so don't render the
      // "Payment received — will not be charged again" framing on retry. The
      // sentinel "devnet-test" is not a real signature and must not be shown
      // as one in the modal.
      const isDevnetTestRetry =
        pendingMint.cluster === "devnet" && pendingMint.paymentSignature === "devnet-test";
      const staleMint = pendingMint.mintKeypair.publicKey.toBase58();
      console.info("[wizard] retry: rebuilding mint flow from scratch", {
        orderId: pendingMint.orderId,
        paymentSignature: pendingMint.paymentSignature,
        staleMint,
        cluster: pendingMint.cluster,
        isDevnetTestRetry,
        path: isDevnetTestRetry ? "retry-devnet-test-no-payment" : "retry-fresh-mint-no-recharge",
        note: "fresh mint keypair + fresh metadata + fresh tx + fresh blockhash; payment NOT resent",
      });
      // Surface the preserved payment signature in the modal immediately so
      // the user sees it the moment retry starts (and during any subsequent
      // failure), not only after the next failure renders. Skip on devnet
      // free-test where no real payment exists.
      setPaymentSig(isDevnetTestRetry ? undefined : pendingMint.paymentSignature);
      try {
        // If a previous attempt sent the payment but verifyPayment failed
        // (e.g. RPC hiccup), re-run verifyPayment first. The server is
        // idempotent for the same (order_id, signature) pair — it will NOT
        // re-charge the user.
        if (pendingMint.needsVerify && !isDevnetTestRetry) {
          setStage("processing");
          await verifyPayment({
            data: {
              order_id: pendingMint.orderId,
              wallet_address: pendingMint.walletAddress,
              payment_signature: pendingMint.paymentSignature,
              cluster: pendingMint.cluster,
            },
          });
        }

        // CRITICAL — the previous mint attempt may have already created the
        // mint account on-chain before failing (e.g. authorities check after
        // create+initialize succeeded). Reusing that keypair would fail with
        // "account already in use". Build a completely fresh mint:
        //   1) brand-new mint keypair
        //   2) brand-new off-chain metadata upload tied to the new address
        //   3) brand-new transaction + brand-new recent blockhash
        //      (mintToken always fetches a fresh blockhash internally)
        // Payment state (orderId, paymentSignature) is preserved untouched —
        // user is NOT recharged.
        setStage("preparing");
        const freshKeypair = await generateMintKeypairForRun();
        const freshMint = freshKeypair.publicKey.toBase58();
        console.info("[wizard] retry: generated fresh mint keypair", {
          orderId: pendingMint.orderId,
          staleMint,
          freshMint,
          regenerated: staleMint !== freshMint,
        });
        const prepared = await prepareMetadata(freshKeypair);
        const refreshed = {
          ...pendingMint,
          mintKeypair: prepared.mintKeypair,
          metadata: prepared.metadata,
          needsVerify: false,
        };
        // Persist refreshed state BEFORE the mint tx so that if the new
        // attempt also fails, the next retry won't try to reuse this
        // keypair either — the next retry will regenerate again.
        setPendingMint(refreshed);
        console.info("[wizard] retry: building fresh mint transaction", {
          orderId: refreshed.orderId,
          mint: freshMint,
        });
        await completeMint(refreshed);
        console.info("[wizard] retry mint succeeded", {
          orderId: refreshed.orderId,
          paymentSignature: refreshed.paymentSignature,
          mint: freshMint,
        });
      } catch (mintErr) {
        const msg = describeMintError(mintErr, !isDevnetTestRetry);
        const failurePoint =
          (mintErr as { failurePoint?: string } | null)?.failurePoint ??
          (mintErr instanceof Error ? mintErr.name : "unknown");
        console.error("[wizard] retry mint failed", {
          orderId: pendingMint.orderId,
          paymentSignature: pendingMint.paymentSignature,
          isDevnetTestRetry,
          failurePoint,
          err: mintErr,
        });
        setErrorMessage(msg);
        setStage("error");
      }
      return;
    }

    setPaymentSig(undefined);

    // Validate inputs
    const supplyDigits = state.totalSupply.replace(/[^0-9]/g, "");
    if (!state.tokenName.trim() || !state.tokenSymbol.trim()) {
      setErrorMessage("Token name and symbol are required.");
      setStage("error");
      return;
    }
    if (!supplyDigits || BigInt(supplyDigits) <= 0n) {
      setErrorMessage("Total supply must be greater than zero.");
      setStage("error");
      return;
    }

    const selected = {
      modifyCreator: state.modifyCreator,
      customAddress: state.customAddress,
      revokeFreeze: state.revokeFreeze,
      revokeMint: state.revokeMint,
      revokeUpdate: state.revokeUpdate,
    };

    // Validate the vanity suffix early — never let raw user text reach
    // PublicKey/Keypair logic. The grinder also re-validates internally.
    // On mobile we additionally clamp to MAX_SUFFIX_LENGTH_MOBILE so weak
    // devices can't be locked into a 4-char grind that will almost
    // certainly time out.
    const effectiveMaxSuffix = onMobile ? MAX_SUFFIX_LENGTH_MOBILE : MAX_SUFFIX_LENGTH;
    if (state.customAddress) {
      const v = validateVanitySuffix(state.customAddressSuffix);
      if (!v.ok) {
        setErrorMessage(`Custom Token Address: ${v.reason}`);
        setStage("error");
        return;
      }
      if (v.suffix.length > effectiveMaxSuffix) {
        setErrorMessage(
          `Custom Token Address: on mobile please use ${effectiveMaxSuffix} characters or fewer (longer suffixes can take too long on phones).`,
        );
        setStage("error");
        return;
      }
    }

    const isDevnetFreeMode = state.cluster === "devnet";

    // (generateMintKeypairForRun + onMobile are hoisted above the retry
    // guard so the retry path can also build a fresh keypair.)

    try {
      // 0. Preflight — ensure wallet has enough SOL for fee + network costs.
      // Mainnet uses a stricter buffer (rent + tx fee + safety margin) and a
      // hard-fail balance check: a real charge is about to happen, so we MUST
      // know the wallet can cover it. Devnet keeps the looser behaviour so
      // free-test mode isn't blocked by transient public RPC hiccups.
      const NETWORK_BUFFER_SOL = state.cluster === "mainnet" ? 0.03 : 0.02;
      const requiredSol = isDevnetFreeMode ? NETWORK_BUFFER_SOL : totalPrice + NETWORK_BUFFER_SOL;
      try {
        const balanceSol = await getWalletBalanceSol(wallet.address, state.cluster);
        console.info("[wizard] preflight balance", {
          cluster: state.cluster,
          balanceSol,
          requiredSol,
        });
        if (balanceSol < requiredSol) {
          const shortBy = (requiredSol - balanceSol).toFixed(4);
          setErrorMessage(
            isDevnetFreeMode
              ? `Insufficient devnet SOL. Fund this wallet with devnet SOL from a faucet before minting. (Need ~${requiredSol.toFixed(3)} SOL, balance ${balanceSol.toFixed(4)} SOL.)`
              : `Insufficient SOL on Solana mainnet. This launch needs ${totalPrice.toFixed(2)} SOL platform fee + ~${NETWORK_BUFFER_SOL.toFixed(2)} SOL for Solana network costs (~${requiredSol.toFixed(2)} SOL total). Your wallet currently has ${balanceSol.toFixed(4)} SOL — add at least ${shortBy} more SOL and try again. No charge has been made.`,
          );
          setStage("error");
          return;
        }
      } catch (balErr) {
        console.error("[wizard] balance preflight failed", { cluster: state.cluster, err: balErr });
        if (state.cluster === "mainnet") {
          // On mainnet we will not let the user proceed to a real payment when
          // we can't confirm their balance — surface the RPC failure clearly.
          const reason = balErr instanceof Error ? balErr.message : String(balErr);
          setErrorMessage(
            `Could not reach Solana mainnet to check your wallet balance, so the launch was stopped before any payment was made. ` +
              `Please check your connection and try again. If this keeps happening, the mainnet RPC may be temporarily unavailable. (Details: ${reason})`,
          );
          setStage("error");
          return;
        }
        // Devnet: don't block the free-test flow on transient RPC hiccups.
      }

      // DEVNET FREE TEST MODE: skip order creation, payment, and verification.
      // Mint directly so devs can test the full minting path without paying.
      if (isDevnetFreeMode) {
        // Generate (or grind) the mint keypair, then upload off-chain JSON
        // metadata so the on-chain `uri` is real.
        setStage("preparing");
        const mintKeypair = await generateMintKeypairForRun();
        const prepared = await prepareMetadata(mintKeypair);
        const devMintAttempt = {
          orderId: "devnet-test",
          paymentSignature: "devnet-test",
          walletAddress: wallet.address,
          cluster: state.cluster,
          decimals: state.decimals,
          initialSupply: supplyDigits,
          revokeFreeze: state.revokeFreeze,
          revokeMint: state.revokeMint,
          revokeUpdate: state.revokeUpdate,
          mintKeypair: prepared.mintKeypair,
          metadata: prepared.metadata,
        };
        setPendingMint(devMintAttempt);
        try {
          await completeMint(devMintAttempt);
        } catch (mintErr) {
          const msg = describeMintError(mintErr, false);
          setErrorMessage(msg);
          setStage("error");
        }
        return;
      }

      // 1. Preparing — grind the (possibly vanity) mint keypair, create the
      //    order on the backend, and upload off-chain metadata. The metadata
      //    URI must exist before the on-chain mint tx is built so the
      //    Token-2022 TokenMetadata extension can reference it at init.
      //    Vanity grinding runs sequentially (not parallel with createOrder)
      //    so a grinder failure aborts before any order is created.
      setStage("preparing");
      const mintKeypair = await generateMintKeypairForRun();
      const [order, prepared] = await Promise.all([
        createOrder({
          data: {
            wallet_address: wallet.address,
            token_name: state.tokenName.trim(),
            token_symbol: state.tokenSymbol.trim(),
            decimals: state.decimals,
            initial_supply: supplyDigits,
            cluster: state.cluster,
            base_fee_sol: BASE_FEE_SOL,
            addon_fee_sol: computeAddonFee(selected),
            selected_options: selected,
            total_fee_sol: computeTotalFee(selected),
          },
        }),
        prepareMetadata(mintKeypair),
      ]);

      // 2. Confirming — wallet signs payment
      setStage("confirming");
      const sig = await sendPayment({
        provider,
        fromAddress: wallet.address,
        toAddress: order.recipient_wallet,
        amountSol: order.amount_sol,
        cluster: state.cluster,
      });
      setPaymentSig(sig);

      // 3. Processing — backend verifies on-chain. If this step fails AFTER
      // payment was sent (RPC hiccup, transient backend error), seed
      // `pendingMint` with `needsVerify: true` so Retry re-runs verifyPayment
      // (idempotent server-side) instead of creating a new order + charging
      // the wallet a second time.
      setStage("processing");
      try {
        await verifyPayment({
          data: {
            order_id: order.order_id,
            wallet_address: wallet.address,
            payment_signature: sig,
            cluster: state.cluster,
          },
        });
      } catch (verifyErr) {
        const verifyMsg = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
        console.error("[wizard] PAYMENT_OK_VERIFY_FAILED — payment preserved, retry will re-verify (no recharge)", {
          orderId: order.order_id,
          paymentSignature: sig,
          cluster: state.cluster,
          err: verifyErr,
        });
        setPendingMint({
          orderId: order.order_id,
          paymentSignature: sig,
          walletAddress: wallet.address,
          cluster: state.cluster,
          decimals: state.decimals,
          initialSupply: supplyDigits,
          revokeFreeze: state.revokeFreeze,
          revokeMint: state.revokeMint,
          revokeUpdate: state.revokeUpdate,
          mintKeypair: prepared.mintKeypair,
          metadata: prepared.metadata,
          needsVerify: true,
        });
        setErrorMessage(
          `Payment was sent on-chain but the server could not verify it just now (${verifyMsg}). ` +
            `You will not be charged again — click Retry Mint to re-verify and finish minting.`,
        );
        setStage("error");
        return;
      }

      const mintAttempt = {
        orderId: order.order_id,
        paymentSignature: sig,
        walletAddress: wallet.address,
        cluster: state.cluster,
        decimals: state.decimals,
        initialSupply: supplyDigits,
        revokeFreeze: state.revokeFreeze,
        revokeMint: state.revokeMint,
        revokeUpdate: state.revokeUpdate,
        mintKeypair: prepared.mintKeypair,
        metadata: prepared.metadata,
      };
      setPendingMint(mintAttempt);

      // 4. Creating Token — only after payment verified
      try {
        await completeMint(mintAttempt);
      } catch (mintErr) {
        // Payment succeeded but mint failed — preserve retry context and do NOT re-charge.
        // The error modal will show the canonical "Payment received. Token mint failed."
        // message + the preserved payment signature, and Retry will re-run completeMint only
        // (see runCreation()'s `if (pendingMint)` guard).
        const msg = describeMintError(mintErr, true);
        console.error("[wizard] PAYMENT_OK_MINT_FAILED — payment preserved, retry will not recharge", {
          orderId: mintAttempt.orderId,
          paymentSignature: mintAttempt.paymentSignature,
          mint: mintAttempt.mintKeypair.publicKey.toBase58(),
          cluster: mintAttempt.cluster,
          retryPath: "completeMint-only",
          err: mintErr,
        });
        setErrorMessage(msg);
        setStage("error");
      }
    } catch (err) {
      // Vanity grinder cancellation is a deliberate user action — close the
      // modal cleanly instead of showing the "Mint failed" error screen. No
      // order/payment exists yet at this point because grinding runs first.
      const reason = (err as { reason?: string } | null)?.reason;
      if (reason === "cancelled") {
        console.info("[wizard] vanity search cancelled by user");
        setStage(null);
        setVanityProgress(null);
        return;
      }
      const msg = err instanceof Error ? err.message : "Something went wrong";
      // Map common wallet-rejection variants (Phantom, Solflare, Backpack,
      // Glow, etc. all phrase this slightly differently) to a friendly line.
      const isWalletRejection =
        /user rejected|user denied|request rejected|rejected the request|cancell?ed|declined/i.test(msg) ||
        (err as { code?: number } | null)?.code === 4001;
      const friendly = isWalletRejection
        ? "You cancelled the transaction in your wallet. No charge was made — click Try Again to retry."
        : msg;
      console.error("[wizard] runCreation failed", { cluster: state.cluster, isWalletRejection, msg });
      setErrorMessage(friendly);
      setStage("error");
    }
  }

  function handleCreate() {
    void runCreation();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold">Token Details &amp; Socials</h2>
        <Toggle
          label="Enable Socials"
          checked={state.socialsEnabled}
          onChange={(v) => set("socialsEnabled", v)}
        />
      </div>

      {state.socialsEnabled && (
        <div className="space-y-3">
          <SocialInput icon={Globe} placeholder="https://yourmemecoin.fun" value={state.website} onChange={(v) => set("website", v)} />
          <SocialInput icon={Twitter} placeholder="https://twitter.com/yourmemecoin" value={state.twitter} onChange={(v) => set("twitter", v)} />
          <SocialInput icon={Send} placeholder="https://t.me/yourchannel" value={state.telegram} onChange={(v) => set("telegram", v)} />
          <SocialInput icon={MessageCircle} placeholder="https://discord.gg/your-server" value={state.discord} onChange={(v) => set("discord", v)} />
        </div>
      )}

      {/* Advanced options */}
      <div className="space-y-3 pt-2">
        <AdvancedRow
          title="Modify Creator Information"
          desc="Attribute your connected wallet as the creator in the off-chain metadata. By default, the creator is shown as MemeMinting. (On-chain authority is unchanged — see Revoke Update below.)"
          checked={state.modifyCreator}
          onChange={(v) => set("modifyCreator", v)}
        />
        {/*
          Custom Token Address — real Web Worker vanity grinder.
          - Suffix is validated client-side (base58 alphabet only, ≤ MAX_SUFFIX_LENGTH).
          - Grinding runs off the main thread (src/lib/solana/vanityWorker.ts).
          - The resulting Keypair IS the actual mint used in the on-chain tx.
          - Suffix text is NEVER passed to PublicKey/Keypair constructors —
            only ASCII-validated through validateVanitySuffix().
        */}
        <AdvancedRow
          title="Custom Token Address"
          desc="Generate a mint address ending in your chosen suffix. Longer or harder suffixes take more time to find."
          checked={state.customAddress}
          onChange={(v) => {
            set("customAddress", v);
            if (!v) setSuffixError(undefined);
          }}
        >
          {state.customAddress && (
            <div className="mt-3 space-y-2">
              <input
                value={state.customAddressSuffix}
                onChange={(e) => {
                  // Strip whitespace and clamp length BEFORE storing — never
                  // hold raw user text longer than the supported suffix.
                  const raw = e.target.value.replace(/\s+/g, "").slice(0, MAX_SUFFIX_LENGTH);
                  set("customAddressSuffix", raw);
                  if (!raw) {
                    setSuffixError(undefined);
                    return;
                  }
                  const v = validateVanitySuffix(raw);
                  setSuffixError(v.ok ? undefined : v.reason);
                }}
                placeholder="MEME"
                maxLength={MAX_SUFFIX_LENGTH}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                className="input-dark"
              />
              <p className="text-xs text-muted-foreground">
                Up to {MAX_SUFFIX_LENGTH} base58 characters (no 0, O, I, l).
                1–2 chars are near-instant; 3 chars usually under a minute;
                4 chars can take several minutes. Search runs in your browser.
              </p>
              {suffixError && (
                <p className="text-xs text-destructive">{suffixError}</p>
              )}
            </div>
          )}
        </AdvancedRow>

      </div>

      {/* Revoke authorities */}
      <div className="pt-4">
        <h3 className="text-center text-lg font-semibold">Revoke Token Authorities</h3>

        <div className="mt-3 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <span className="text-success font-semibold">Understanding authorities:</span>{" "}
          When selected (checked), the authority will be permanently revoked (set to null). When
          unselected (unchecked), the authority will be transferred to your wallet.
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3 items-stretch">
          <AuthorityCard
            title="Revoke Freeze"
            desc="Freeze Authority allows freezing token accounts. Revoke it to prevent tokens from being frozen."
            checked={state.revokeFreeze}
            onClick={() => set("revokeFreeze", !state.revokeFreeze)}
          />
          <AuthorityCard
            title="Revoke Mint"
            desc="Mint Authority allows creating more tokens. Revoke it to make supply fixed and prevent inflation."
            checked={state.revokeMint}
            onClick={() => set("revokeMint", !state.revokeMint)}
          />
          <AuthorityCard
            title="Revoke Update"
            desc="Update Authority allows changing the on-chain name, symbol, and metadata URI. Revoke it to make those on-chain fields permanent. (Off-chain JSON content at the URI is not affected.)"
            checked={state.revokeUpdate}
            onClick={() => set("revokeUpdate", !state.revokeUpdate)}
          />
        </div>
      </div>

      {/* Network selector */}
      <div className="rounded-2xl border border-border bg-muted/20 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h4 className="font-medium">Network</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose the Solana cluster to mint on. Devnet is free test SOL.
            </p>
          </div>
          <div className="inline-flex rounded-full border border-white/10 bg-background/40 p-1">
            <button
              type="button"
              onClick={() => set("cluster", "devnet")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${
                state.cluster === "devnet"
                  ? "bg-gradient-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Devnet
            </button>
            <button
              type="button"
              onClick={() => set("cluster", "mainnet")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${
                state.cluster === "mainnet"
                  ? "bg-gradient-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Mainnet
            </button>
          </div>
        </div>
        {state.cluster === "devnet" && (
          <p className="mt-3 text-xs text-success">
            Devnet test mode: platform fee is disabled. Only devnet network/account costs apply.
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2 sm:justify-between">
        <button
          onClick={() => setStep(2)}
          className="btn-secondary w-full sm:w-auto rounded-full border border-white/10 bg-card/60 px-6 py-3 text-sm font-semibold"
        >
          Back
        </button>
        <button
          onClick={handleCreate}
          disabled={stage !== null && stage !== "success" && stage !== "error"}
          className="btn-primary w-full sm:w-auto rounded-full bg-gradient-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-70"
        >
          {wallet
            ? state.cluster === "devnet"
              ? "Create Token (Devnet · Free)"
              : `Create Token (${totalPrice.toFixed(2)} SOL)`
            : state.cluster === "devnet"
              ? "Connect Wallet · Devnet Free"
              : `Connect Wallet · ${totalPrice.toFixed(2)} SOL`}
        </button>
      </div>

      <p className="text-center text-xs text-muted-foreground pt-2">24/7 Support Available</p>

      <CreationModal
        open={stage !== null}
        stage={stage ?? "preparing"}
        mintAddress={mintAddress}
        paymentSignature={paymentSig}
        errorMessage={errorMessage}
        tokenName={state.tokenName}
        tokenSymbol={state.tokenSymbol}
        totalSol={totalPrice}
        cluster={state.cluster}
        vanityProgress={vanityProgress ?? undefined}
        vanitySuffix={state.customAddress ? state.customAddressSuffix : undefined}
        onCancelVanity={() => {
          vanityHandleRef.current?.cancel();
        }}
        onClose={() => setStage(null)}
        onRetry={handleCreate}
      />
    </div>
  );
}

function SocialInput({
  icon: Icon,
  placeholder,
  value,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-dark pl-10"
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-3 cursor-pointer">
      {label && <span className="text-sm">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-gradient-primary" : "bg-muted border border-border"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </label>
  );
}

function AdvancedRow({
  title,
  desc,
  checked,
  onChange,
  children,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="card-premium rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium">{title}</h4>
            <span className="text-[11px] rounded-full bg-accent/15 text-accent border border-accent/30 px-2 py-0.5">
              +0.10 SOL
            </span>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
        </div>
        <Toggle checked={checked} onChange={onChange} />
      </div>
      {children}
    </div>
  );
}

function AuthorityCard({
  title,
  desc,
  checked,
  onClick,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-premium rounded-2xl p-5 text-left transition flex flex-col h-full w-full"
    >
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{title}</h4>
        <span className="text-[11px] rounded-full bg-accent/15 text-accent border border-accent/30 px-2 py-0.5">
          +0.10 SOL
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
      <div className="mt-auto pt-4">
        <div
          className={`rounded-xl px-3 py-2 text-center text-sm font-medium ${
            checked
              ? "bg-gradient-primary text-primary-foreground"
              : "bg-muted text-muted-foreground border border-border"
          }`}
        >
          {checked ? "Selected (Will Revoke)" : "Not Selected"}
        </div>
      </div>
    </button>
  );
}
