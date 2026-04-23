import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Faq } from "@/components/landing/Faq";
import { CtaSection } from "@/components/landing/CtaSection";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MemeMinting — Launch your Solana token in minutes" },
      {
        name: "description",
        content:
          "Premium Solana token creator. Configure, pay, and mint SPL tokens in 3 steps. Continue to Raydium for liquidity.",
      },
      { property: "og:title", content: "MemeMinting — Launch your Solana token" },
      {
        property: "og:description",
        content: "Configure, pay, and mint SPL tokens in 3 steps.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <Faq />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
