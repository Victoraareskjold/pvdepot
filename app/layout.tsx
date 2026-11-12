import type { Metadata, Viewport } from "next";
// Skriften ligger lokalt (ingen kall til Google Fonts).
import "@fontsource-variable/archivo/wdth.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lading for tunge kjøretøy",
  description: "Regn ut ladeanlegg, solceller og Enova-støtte for depotet, og sjekk om bedriften kvalifiserer.",
  robots: { index: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body>{children}</body>
    </html>
  );
}
