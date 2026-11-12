"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { SceneProps } from "./DepotScene";

// 3D-koden lastes etter at tallene vises, og aldri på serveren.
const DepotScene = dynamic(() => import("./DepotScene"), {
  ssr: false,
  loading: () => <div className="scene-loading" aria-hidden />,
});

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function SceneStage(props: SceneProps) {
  const [mode, setMode] = useState<"pending" | "3d" | "flat">("pending");

  useEffect(() => {
    // Vent til nettleseren er ledig, så kalkylen svarer raskt først.
    const start = () => setMode(hasWebGL() ? "3d" : "flat");
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(start);
    else setTimeout(start, 200);
  }, []);

  if (mode === "flat") return <FlatScene {...props} />;
  if (mode === "pending") return <div className="scene-loading" aria-hidden />;
  return <DepotScene {...props} />;
}

/** Enkel tegning for nettlesere uten WebGL. */
function FlatScene({ vehicles, solarCoverage, batteryKwh, accent, energy }: SceneProps) {
  const trucks = Math.min(vehicles, 10);
  return (
    <svg viewBox="0 0 400 220" className="scene-flat" role="img" aria-label="Illustrasjon av depotet">
      <rect width="400" height="220" fill="#dfe6ef" />
      <rect x="60" y="40" width="240" height="80" fill="#d5deea" stroke="#9fb0c5" />
      <rect x="60" y="34" width={240 * solarCoverage} height="8" fill="#1d2f4d" />
      {solarCoverage > 0 && <rect x="60" y="30" width={240 * solarCoverage} height="3" fill={energy} />}
      {batteryKwh > 0 && <rect x="20" y="90" width="30" height="30" fill="#f2f5f9" stroke="#19b37a" />}
      {Array.from({ length: trucks }, (_, i) => (
        <g key={i} transform={`translate(${40 + i * 33} 150)`}>
          <rect width="26" height="12" fill={accent} />
          <rect y="12" width="26" height="30" fill="#f7f9fc" stroke="#c8d1dd" />
        </g>
      ))}
    </svg>
  );
}
