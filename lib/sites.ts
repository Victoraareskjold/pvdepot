/** Utseende og tekst for nettstedet appen vises på. */
export interface SiteTheme {
  name: string;
  /** Hovedfarge: knapper, valgte elementer, lastebilene i scenen */
  accent: string;
  /** Energi og sol */
  energy: string;
  phone?: string;
  /** Logo i public/, vises øverst */
  logo: { src: string; width: number; height: number };
}

/** Appen er bare for Smart Elektro Sol foreløpig. */
export const THEME: SiteTheme = {
  name: "Smart Elektro",
  accent: "#0067a6",
  energy: "#ff9d00",
  phone: "+47 48 26 22 18",
  logo: { src: "/brand/smartelektrosol.png", width: 717, height: 341 },
};
