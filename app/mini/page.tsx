import type { Metadata } from "next";
import MiniDepot from "@/components/MiniDepot";

export const metadata: Metadata = {
  title: "Lastebillading",
  robots: { index: false },
};

/**
 * Liten versjon av depotet til forsiden på smartelektrosol.no (Victor,
 * 28.11.2026). Vises i en iframe ved siden av teksten om lastebillading.
 */
export default function Mini() {
  return <MiniDepot />;
}
