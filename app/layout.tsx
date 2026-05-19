import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sels UCOB",
  description: "Sistema de Gestão de Pedidos — Sels UCOB",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body>{children}</body>
    </html>
  );
}
