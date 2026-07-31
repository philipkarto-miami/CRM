import type { Metadata } from "next";
import "./globals.css";

// Note : on utilise volontairement des piles de polices systeme (pas de
// next/font/google) pour que le build ne depende d'aucun acces reseau a
// Google Fonts — plus robuste en CI/deploiement. Si tu veux une police plus
// editoriale (ex: Playfair Display), tu peux la re-brancher via next/font/google
// une fois le projet chez toi, ou l'auto-heberger via next/font/local.

export const metadata: Metadata = {
  title: "Philip Karto — Atelier CRM",
  description: "Suivi des stocks, achats/ventes et fabrication des sacs — Atelier Philip Karto",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
