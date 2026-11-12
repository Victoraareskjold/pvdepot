/**
 * Utseende og tekst per nettsted. `site` kommer fra URL-en (?site=…) og er
 * samme nøkkel som i pvwebsites og installer_groups.site i Supabase.
 */
export interface SiteTheme {
  name: string;
  /** Hovedfarge: knapper, valgte elementer, lastebilene i scenen */
  accent: string;
  /** Energi og sol */
  energy: string;
  phone?: string;
}

const SITES: Record<string, SiteTheme> = {
  smartelektrosol: { name: "Smart Elektro", accent: "#0067a6", energy: "#ff9d00", phone: "+47 48 26 22 18" },
};

const FALLBACK: SiteTheme = { name: "Soleklart", accent: "#1d5fa8", energy: "#f5a524" };

export function siteTheme(site: string | undefined): SiteTheme {
  return (site && SITES[site.toLowerCase()]) || FALLBACK;
}

export function isKnownSite(site: string | undefined): boolean {
  return !!site && site.toLowerCase() in SITES;
}
