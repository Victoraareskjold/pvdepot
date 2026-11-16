"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { WorldProps } from "./world/World";

// 3D-verdenen lastes etter at siden og tallene er klare, og aldri på serveren.
const World = dynamic(() => import("./world/World"), { ssr: false, loading: () => null });

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function WorldStage(props: WorldProps) {
  const [mode, setMode] = useState<"pending" | "3d" | "flat">("pending");

  // Start 3D først når seksjonen nærmer seg skjermen.
  useEffect(() => {
    if (mode !== "pending" || props.active === false) return;
    setMode(hasWebGL() ? "3d" : "flat");
  }, [mode, props.active]);

  return (
    <div className={`world world-${mode}`} aria-hidden>
      {mode === "3d" && <World {...props} />}
      {mode === "flat" && <FlatWorld accent={props.accent} energy={props.energy} bays={props.bays} />}
    </div>
  );
}

/** Enkel tegning for nettlesere uten WebGL. */
function FlatWorld({ accent, energy, bays }: { accent: string; energy: string; bays: number }) {
  const n = Math.min(bays, 10);
  return (
    <svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" className="world-flat">
      <rect width="800" height="500" fill="#e4e7f3" />
      <polygon points="300,120 640,120 700,170 360,170" fill="#c9d1e3" />
      <polygon points="300,120 360,170 360,280 300,230" fill="#d3dbec" />
      <polygon points="360,170 700,170 700,280 360,280" fill="#e8edf8" />
      <polygon points="330,128 620,128 660,160 370,160" fill="#1b3a78" />
      <rect x="370" y="150" width="280" height="4" fill={energy} />
      {Array.from({ length: n }, (_, i) => (
        <g key={i} transform={`translate(${250 + i * 46} 320)`}>
          <rect width="34" height="16" fill={accent} rx="3" />
          <rect y="16" width="34" height="56" fill="#fbfcff" stroke="#cbd5ea" rx="2" />
        </g>
      ))}
    </svg>
  );
}
