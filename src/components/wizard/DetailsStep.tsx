import { useState } from "react";
import { Globe, Twitter, Send, MessageCircle } from "lucide-react";
import { useWizard } from "./WizardContext";
import { useWallet } from "@/components/wallet/WalletContext";
import { CreationModal, type CreationStage } from "./CreationModal";
import { createOrder, verifyPayment, saveTokenResult } from "@/server/orders.functions";
import { sendPayment, mintToken } from "@/lib/solana/mint";
import { computeAddonFee, computeTotalFee } from "@/lib/pricing";

export function DetailsStep() {
  const { state, set, setStep, totalPrice } = useWizard();
  const { wallet, provider, openPicker } = useWallet();
  const [stage, setStage] = useState<CreationStage | null>(null);
  const [mintAddress, setMintAddress] = useState<string | undefined>();
  const [paymentSig, setPaymentSig] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function runCreation() {
    setErrorMessage(undefined);
    setMintAddress(undefined);
    setPaymentSig(undefined);

    if (!wallet || !provider) {
      openPicker();
      return;
    }

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

    try {
      // 1. Preparing — create order on the backend
      setStage("preparing");
      const order = await createOrder({
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
      });

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

      // 4. Creating Token — only after payment verified
      setStage("creating");
      let mintRes;
      try {
        mintRes = await mintToken({
          provider,
          payerAddress: wallet.address,
          cluster: state.cluster,
          decimals: state.decimals,
          initialSupply: supplyDigits,
          revokeFreeze: state.revokeFreeze,
          revokeMint: state.revokeMint,
        });
      } catch (mintErr) {
        // Payment succeeded but mint failed — do NOT silently retry-charge.
        const msg =
          mintErr instanceof Error ? mintErr.message : "Mint transaction failed";
        setErrorMessage(
          `Payment was received but the token mint failed: ${msg}. Your payment signature is preserved — contact support before retrying to avoid double-charge.`,
        );
        setStage("error");
        return;
      }

      await saveTokenResult({
        data: {
          order_id: order.order_id,
          payment_signature: sig,
          token_signature: mintRes.signature,
          mint_address: mintRes.mintAddress,
          ata_address: mintRes.ataAddress,
          cluster: state.cluster,
        },
      });

      setMintAddress(mintRes.mintAddress);
      setStage("success");
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
        <AdvancedRow
          title="Custom Token Address"
          desc="Generate a token with a custom address suffix (up to 4 characters)."
          checked={state.customAddress}
          onChange={(v) => set("customAddress", v)}
        >
          {state.customAddress && (
            <input
              value={state.customAddressSuffix}
              onChange={(e) => set("customAddressSuffix", e.target.value.slice(0, 4))}
              placeholder="MEME"
              maxLength={4}
              className="input-dark mt-3"
            />
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

        <div className="mt-4 grid gap-3 md:grid-cols-3">
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
          {wallet ? `Create Token (${totalPrice.toFixed(2)} SOL)` : `Connect Wallet · ${totalPrice.toFixed(2)} SOL`}
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
      className={`card-premium rounded-2xl p-5 text-left transition ${checked ? "ring-2 ring-primary/60" : ""}`}
    >
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{title}</h4>
        <span className="text-[11px] rounded-full bg-accent/15 text-accent border border-accent/30 px-2 py-0.5">
          +0.10 SOL
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
      <div
        className={`mt-4 rounded-xl px-3 py-2 text-center text-sm font-medium ${
          checked
            ? "bg-gradient-primary text-primary-foreground"
            : "bg-muted text-muted-foreground border border-border"
        }`}
      >
        {checked ? "Selected (Will Revoke)" : "Not Selected"}
      </div>
    </button>
  );
}
