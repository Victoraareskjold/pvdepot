"use client";

import { useEffect, useState } from "react";
import { live, STATE_LABEL, type BayStatus } from "./world/live";
import { int } from "@/lib/format";

/** Sanntidsoversikt over ladeplassene, lest fra simuleringen i scenen. */
export default function LivePanel({ chargerKw, total }: { chargerKw: number; total: number }) {
  const [bays, setBays] = useState<BayStatus[]>([]);
  const [solar, setSolar] = useState({ installed: 0, installing: false });

  useEffect(() => {
    const id = setInterval(() => {
      setBays(live.bays.slice());
      setSolar({ installed: live.solarInstalled, installing: live.installing });
    }, 300);
    return () => clearInterval(id);
  }, []);

  const charging = bays.filter((b) => b.state === "lader").length;
  const shown = bays.slice(0, 5);

  return (
    <aside className="live" aria-label="Ladeplassene akkurat nå">
      <div className="live-head">
        <span className="live-dot" />
        <strong>Ladeplassene nå</strong>
        <span className="live-sum">
          {charging} av {bays.length} lader, {int(charging * chargerKw)} kW
        </span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Plass</th>
            <th>Bil</th>
            <th>Status</th>
            <th className="num">Batteri</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((b) => (
            <tr key={b.id}>
              <td>L{b.id}</td>
              <td className="plate">{b.state === "ledig" ? "–" : b.plate}</td>
              <td>
                <span className={`pill pill-${b.state}`}>{STATE_LABEL[b.state]}</span>
              </td>
              <td className="num">
                {b.state === "ledig" ? (
                  "–"
                ) : (
                  <span className="soc">
                    <span className="soc-bar">
                      <span style={{ width: `${Math.round(b.soc * 100)}%` }} />
                    </span>
                    {Math.round(b.soc * 100)} %
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {total > shown.length && <p className="live-more">Viser {shown.length} av {total} ladeplasser</p>}
      {solar.installing && (
        <p className="live-solar">
          <span className="sun" /> Monterer solceller: {Math.round(solar.installed * 100)} %
        </p>
      )}
    </aside>
  );
}
