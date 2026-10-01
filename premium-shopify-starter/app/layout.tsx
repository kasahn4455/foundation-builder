import type { Metadata } from "next";
import "./globals.css";

const storeName = process.env.NEXT_PUBLIC_STORE_NAME || "Maison";

export const metadata: Metadata = {
  title: { default: storeName, template: `%s | ${storeName}` },
  description: process.env.NEXT_PUBLIC_STORE_TAGLINE || "Curated products, beautifully presented."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
