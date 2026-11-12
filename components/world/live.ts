/**
 * Delt tilstand mellom simuleringen i 3D-scenen og panelene i DOM-en.
 * Simuleringen skriver hver frame, panelene leser noen ganger i sekundet.
 */

export type BayState = "ledig" | "ankommer" | "kobler" | "lader" | "ferdig" | "rygger" | "kjorer";

export interface BayStatus {
  id: number;
  plate: string;
  state: BayState;
  /** Batterinivå 0–1 */
  soc: number;
}

export interface LiveState {
  bays: BayStatus[];
  /** Andel av panelene som er montert, 0–1 */
  solarInstalled: number;
  installing: boolean;
}

export const live: LiveState = { bays: [], solarInstalled: 0, installing: false };

export const STATE_LABEL: Record<BayState, string> = {
  ledig: "Ledig",
  ankommer: "Kjører inn",
  kobler: "Kobler til",
  lader: "Lader",
  ferdig: "Fulladet",
  rygger: "Rygger ut",
  kjorer: "Kjører ut",
};
