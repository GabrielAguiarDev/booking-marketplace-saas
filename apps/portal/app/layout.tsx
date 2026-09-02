import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Vez — Portal do estabelecimento",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
