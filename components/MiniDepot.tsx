"use client";

import { useEffect, useState } from "react";
import WorldStage from "./WorldStage";
import { THEME } from "@/lib/sites";
import { BATTERY_UNIT, SOLAR, STANDARD_PACKAGE } from "@/lib/calc/assumptions";

/**
 * Depotet fra ladesiden, forenklet til lite format: fire lasteramper med
 * lastebiler som rygger inn og lader, solceller og batteri, uten merkelapper,
 * paneler eller tekst. Scenen tegnes bare når fanen er synlig.
 */
export default function MiniDepot() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <main className="mini" aria-label="Illustrasjon: lastebiler som lader ved lasterampene på et depot">
      <WorldStage
        mini
        active={visible}
        bays={4}
        vehicleModel="rigid"
        roofM2={STANDARD_PACKAGE.solarKwp / (SOLAR.kwpPerM2 * SOLAR.refCoverage)}
        solarCoverage={SOLAR.refCoverage}
        batteryKwh={STANDARD_PACKAGE.batteryUnits * BATTERY_UNIT.kwh}
        gridUpgrade={false}
        chargerKw={STANDARD_PACKAGE.chargerKw}
        shot="hero"
        accent={THEME.accent}
        energy={THEME.energy}
        sign="DITT DEPOT"
        labels={{ chargers: "" }}
        inset={{ left: 0, top: 0, bottom: 0 }}
      />
    </main>
  );
}
