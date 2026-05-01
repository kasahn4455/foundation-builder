import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useReveal } from "@/hooks/use-reveal";

const faqs = [
  {
    q: "How much does it cost to create a token?",
    a: "Base fee is 0.30 SOL. Each optional add-on (modify creator, custom address, revoke freeze/mint/update) is +0.10 SOL.",
  },
  {
    q: "Will my token be tradable on Raydium automatically?",
    a: "No. Minting your token does not create liquidity. After mint, you must continue to Raydium and create a liquidity pool separately.",
  },
  {
    q: "What does revoking an authority do?",
    a: "Revoking permanently removes that authority from the token (freeze, mint, or update), making the token more trustless.",
  },
  {
    q: "Do I pay before or after the token is minted?",
    a: "You pay first. We verify the payment on-chain, then mint your token. Your token is never minted before payment is confirmed.",
  },
  {
    q: "Which wallets are supported?",
    a: "We support Phantom, Solflare, Backpack, and any Solana wallet that follows the standard wallet adapter protocol.",
  },
  {
    q: "Do you store my private keys or seed phrase?",
    a: "Never. We never see, request, or store your private keys. All transactions are signed locally in your wallet — we only receive the signed transaction to broadcast.",
  },
  {
    q: "How long does it take to create a token?",
    a: "Usually under a minute. Once payment is confirmed on-chain, your token is minted immediately and the mint address is shown in the wizard.",
  },
  {
    q: "Can I add a custom logo and metadata to my token?",
    a: "Yes. You can set the name, symbol, decimals, supply, and upload a logo and description during the wizard. The on-chain Token-2022 Token Metadata extension stores the name, symbol, and a HTTPS URI; the logo and JSON manifest (description, socials) are hosted in public storage at that URI.",
  },
  {
    q: "What happens if the transaction fails?",
    a: "If the on-chain mint fails after payment, the wizard shows a clear error and a Retry button that rebuilds the mint without charging again — your payment is preserved. If payment never confirms, no token is created and no fee is taken.",
  },
  {
    q: "Can I sell my token after minting?",
    a: "Yes, but you must create a liquidity pool first (e.g., on Raydium or Meteora). Until a pool exists, the token has no market price and cannot be traded.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const header = useReveal<HTMLDivElement>();
  const list = useReveal<HTMLDivElement>();

  return (
    <section id="faq" className="px-4 py-24 md:py-28">
      <div className="mx-auto max-w-3xl">
        <div ref={header.ref} className={`reveal ${header.visible ? "is-visible" : ""} text-center`}>
          <div className="text-[11px] uppercase tracking-[0.2em] text-accent/80 mb-3">FAQ</div>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">Frequently asked questions</h2>
        </div>

        <div
          ref={list.ref}
          className={`reveal-stagger ${list.visible ? "is-visible" : ""} mt-12 space-y-3`}
        >
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="reveal-item card-premium rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className="font-medium tracking-tight">{f.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${isOpen ? "rotate-180 text-accent" : ""}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 text-sm text-muted-foreground leading-relaxed border-t border-white/5 pt-4">
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
