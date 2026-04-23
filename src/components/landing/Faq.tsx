import { useState } from "react";
import { ChevronDown } from "lucide-react";

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
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="px-4 py-20">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Frequently asked questions</h2>
        </div>

        <div className="mt-10 space-y-3">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="card-premium rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="font-medium">{f.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && <div className="px-5 pb-5 text-sm text-muted-foreground">{f.a}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
