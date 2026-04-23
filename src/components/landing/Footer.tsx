import { Wordmark } from "@/components/brand/Wordmark";

export function Footer() {
  return (
    <footer className="border-t border-white/5 px-4 py-10 mt-8">
      <div className="mx-auto max-w-6xl flex flex-col gap-6 text-sm text-muted-foreground">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <Wordmark size="sm" />
          <div>© {new Date().getFullYear()} MemeMinting. All rights reserved.</div>
          <div>24/7 Support Available</div>
        </div>

        <div className="border-t border-white/5 pt-6 text-xs leading-relaxed text-muted-foreground/80 space-y-3">
          <p>
            <span className="text-foreground/80 font-medium">Disclaimer:</span> MemeMinting is a self-service
            tool that helps users deploy SPL tokens on the Solana blockchain. We do not issue, endorse,
            promote, or guarantee the value of any token created through this platform. Tokens created
            here are not securities, investments, or financial instruments offered by MemeMinting.
          </p>
          <p>
            <span className="text-foreground/80 font-medium">No Financial Advice:</span> Nothing on this
            website constitutes financial, investment, legal, or tax advice. Cryptocurrency and token
            creation involve significant risk, including total loss of funds. You are solely responsible
            for your decisions, compliance with local laws, and any tax obligations in your jurisdiction.
          </p>
          <p>
            <span className="text-foreground/80 font-medium">User Responsibility:</span> By using
            MemeMinting, you confirm that you are of legal age in your jurisdiction and that creating
            and distributing tokens is permitted where you reside. You agree not to use the service for
            fraud, money laundering, market manipulation, or any unlawful activity. All blockchain
            transactions are final and irreversible.
          </p>
          <p>
            <span className="text-foreground/80 font-medium">No Liquidity Guarantee:</span> Minting a
            token does not create a market, liquidity, or tradability. MemeMinting is not affiliated
            with Raydium, Meteora, or any exchange.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-2">
            <a href="#" className="hover:text-accent transition">Terms of Service</a>
            <a href="#" className="hover:text-accent transition">Privacy Policy</a>
            <a href="#" className="hover:text-accent transition">Cookie Policy</a>
            <a href="#" className="hover:text-accent transition">Risk Disclosure</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
