import "@/lib/polyfills";
import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { WalletProvider } from "@/components/wallet/WalletContext";
import { WalletPickerModal } from "@/components/wallet/WalletPickerModal";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable App" },
      { name: "description", content: "Create and manage custom tokens with advanced metadata and authority options." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "Create and manage custom tokens with advanced metadata and authority options." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Lovable App" },
      { name: "twitter:description", content: "Create and manage custom tokens with advanced metadata and authority options." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ceacb945-68b6-4da6-a6ca-0320dcfa0258/id-preview-865a7a34--bed50627-a0f2-446d-8522-7df3f0531370.lovable.app-1777674990678.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ceacb945-68b6-4da6-a6ca-0320dcfa0258/id-preview-865a7a34--bed50627-a0f2-446d-8522-7df3f0531370.lovable.app-1777674990678.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function sanitizeRpcUrl(raw: string | undefined): string {
  if (!raw) return "";
  let v = raw.trim().replace(/^["']|["']$/g, "");
  // Strip accidental "KEY=value" paste (e.g. "SOLANA_MAINNET_RPC_URL=https://...")
  const eq = v.indexOf("=");
  if (eq !== -1 && /^[A-Z_][A-Z0-9_]*$/.test(v.slice(0, eq).trim())) {
    v = v.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return v.startsWith("http://") || v.startsWith("https://") ? v : "";
}

function RootShell({ children }: { children: React.ReactNode }) {
  const runtimeMainnetRpc = sanitizeRpcUrl(process.env.SOLANA_MAINNET_RPC_URL);
  const runtimeConfigScript = `window.__SOLANA_RPC_CONFIG__ = ${JSON.stringify({ mainnetRpcUrl: runtimeMainnetRpc })};`;

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: runtimeConfigScript }} />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <WalletProvider>
      <Outlet />
      <WalletPickerModal />
    </WalletProvider>
  );
}
