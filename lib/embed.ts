"use client";

/**
 * Kontrakten mellom appen (i iframe) og nettsiden rundt.
 *
 * Appen sender:
 *   { source: "pvdepot", type: "resize", height }      ved hver høydeendring
 *   { source: "pvdepot", type: "lead", eventId, value } når et lead er sendt
 *
 * Nettsiden setter iframe-høyden og sender brukeren til /takk når et lead er
 * sendt. Der teller Consentify/GTM konverteringen etter samtykke. Appen
 * laster ingen pixler selv.
 */

export const EMBED_SOURCE = "pvdepot";

export interface TrackingParams {
  site: string;
  gclid: string;
  fbclid: string;
  utmCampaign: string;
}

export function readTrackingParams(): TrackingParams {
  const p = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  return {
    site: p.get("site") || "smartelektrosol",
    gclid: p.get("gclid") || "",
    fbclid: p.get("fbclid") || "",
    utmCampaign: p.get("utm_campaign") || "",
  };
}

export const isEmbedded = () => typeof window !== "undefined" && window.parent !== window;

function post(message: Record<string, unknown>) {
  if (!isEmbedded()) return;
  window.parent.postMessage({ source: EMBED_SOURCE, ...message }, "*");
}

/** Sender dokumenthøyden til nettsiden hver gang den endres. Returnerer opprydding. */
export function startResizeReporting(): () => void {
  if (!isEmbedded()) return () => {};
  let last = 0;
  const send = () => {
    const height = Math.ceil(document.documentElement.scrollHeight);
    if (height !== last) {
      last = height;
      post({ type: "resize", height });
    }
  };
  const ro = new ResizeObserver(send);
  ro.observe(document.body);
  send();
  return () => ro.disconnect();
}

export function reportLead(eventId: string, value: number) {
  post({ type: "lead", eventId, value, currency: "NOK" });
}
