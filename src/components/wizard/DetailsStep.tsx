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
import { computeAddonFee, computeTotalFee } from "@/lib/pricing";
import {
  grindVanityMintKeypair,
  validateVanitySuffix,
  isLikelyMobile,
  MAX_SUFFIX_LENGTH,
  MAX_SUFFIX_LENGTH_MOBILE,
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
  } | null>(null);

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

    let imageBase64: string | undefined;
    let imageMime: string | undefined;
    if (state.tokenLogo) {
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

    const res = await uploadTokenMetadata({
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

    // RETRY GUARD — if a previous attempt already paid + verified but the mint
    // tx failed, `pendingMint` is preserved. Retrying re-runs ONLY the mint
    // step (completeMint), never createOrder/sendPayment/verifyPayment, so
    // the user is never charged twice for the same token.
    if (pendingMint) {
      console.info("[wizard] retrying mint with preserved order", {
        orderId: pendingMint.orderId,
        paymentSignature: pendingMint.paymentSignature,
        mint: pendingMint.mintKeypair.publicKey.toBase58(),
      });
      try {
        await completeMint(pendingMint);
      } catch (mintErr) {
        const msg = mintErr instanceof Error ? mintErr.message : "Mint transaction failed";
        setErrorMessage(`Mint retry failed: ${msg}. Your payment is preserved — try again.`);
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
    if (state.customAddress) {
      const v = validateVanitySuffix(state.customAddressSuffix);
      if (!v.ok) {
        setErrorMessage(`Custom Token Address: ${v.reason}`);
        setStage("error");
        return;
      }
    }

    const isDevnetFreeMode = state.cluster === "devnet";

    /**
     * Produce the mint keypair for this run. If Custom Token Address is
     * enabled, run the Web Worker grinder until we find a keypair whose
     * base58 public key ends with the user's validated suffix. Otherwise
     * fall back to a one-shot random keypair.
     */
    const generateMintKeypairForRun = async (): Promise<Keypair> => {
      if (!state.customAddress) return generateMintKeypair();
      setVanityProgress({ attempts: 0, elapsedMs: 0 });
      const handle = grindVanityMintKeypair({
        suffix: state.customAddressSuffix.trim(),
        caseSensitive: true,
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

    try {
      // 0. Preflight — ensure wallet has enough SOL for fee + network costs
      const NETWORK_BUFFER_SOL = 0.02;
      const requiredSol = isDevnetFreeMode ? NETWORK_BUFFER_SOL : totalPrice + NETWORK_BUFFER_SOL;
      try {
        const balanceSol = await getWalletBalanceSol(wallet.address, state.cluster);
        if (balanceSol < requiredSol) {
          setErrorMessage(
            isDevnetFreeMode
              ? `Insufficient devnet SOL. Fund this wallet with devnet SOL from a faucet before minting. (Need ~${requiredSol.toFixed(3)} SOL, balance ${balanceSol.toFixed(4)} SOL.)`
              : `Insufficient SOL balance. You need enough SOL to cover the platform fee and network costs. Required ~${requiredSol.toFixed(2)} SOL, your balance is ${balanceSol.toFixed(4)} SOL.`,
          );
          setStage("error");
          return;
        }
      } catch (balErr) {
        console.warn("[wizard] balance preflight failed", balErr);
        // Don't block the flow on RPC hiccups — payment step will surface real errors.
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
          const msg = mintErr instanceof Error ? mintErr.message : "Mint transaction failed";
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
            base_fee_sol: 0.3,
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

      // 3. Processing — backend verifies on-chain
      setStage("processing");
      await verifyPayment({
        data: {
          order_id: order.order_id,
          wallet_address: wallet.address,
          payment_signature: sig,
          cluster: state.cluster,
        },
      });

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
        const msg = mintErr instanceof Error ? mintErr.message : "Mint transaction failed";
        setErrorMessage(msg);
        setStage("error");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      // Map common wallet rejections to a friendlier message
      const friendly = /User rejected|reject/i.test(msg)
        ? "You cancelled the transaction in your wallet."
        : msg;
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
          desc="Change the information of the creator in the metadata. By default, it is MemeMinting."
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
            desc="Update Authority allows changing token metadata. Revoke it to make metadata permanent."
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
