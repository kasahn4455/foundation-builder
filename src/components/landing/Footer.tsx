import { Wordmark } from "@/components/brand/Wordmark";

export function Footer() {
  return (
    <footer className="border-t border-white/5 px-4 py-10 mt-8">
      <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <Wordmark size="sm" />
        <div>© {new Date().getFullYear()} MemeMinting. All rights reserved.</div>
        <div>24/7 Support Available</div>
      </div>
    </footer>
  );
}
