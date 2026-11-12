import { describe, expect, test } from "bun:test";
import { computeLayout, CHARGER_SIDE, type VehicleModel } from "./layout";
import { buildRoutes, newSim, pose, step, type BaySim, type Pose } from "./sim";
import { mulberry } from "./rand";

/**
 * Kjører trafikken i lang tid og sjekker at ingen biler overlapper hverandre
 * eller laderne. Bilen er modellert som sirkler langs karosseriet.
 */

const HALF_W = 1.25;

function bodyCircles(p: Pose, L: number): [number, number][] {
  const n = Math.ceil(L / 2.2) + 1;
  const out: [number, number][] = [];
  const cx = Math.cos(p.yaw);
  const sz = -Math.sin(p.yaw);
  for (let k = 0; k < n; k++) {
    const off = -L / 2 + HALF_W + ((L - 2 * HALF_W) * k) / (n - 1);
    out.push([p.x + cx * off, p.z + sz * off]);
  }
  return out;
}

function run(model: VehicleModel, bays: number, seconds: number, dt: number, seed: number) {
  const layout = computeLayout({
    bays,
    vehicleModel: model,
    roofM2: 3000,
    solarCoverage: 0.6,
    batteryKwh: 800,
    gridUpgrade: true,
    chargerKw: 150,
  });
  const routes = buildRoutes(layout);
  const rnd = mulberry(seed);
  const list: BaySim[] = Array.from({ length: bays }, (_, i) => newSim(i, true, rnd, false));
  const locks = { entry: -1, exit: -1 };
  const poses: Pose[] = list.map(() => ({ visible: false, x: 0, z: 0, yaw: 0 }));
  const chargers = layout.bays.map((b) => [layout.chargerX, b.z + CHARGER_SIDE] as const);

  let minGap = Infinity;
  let minCharger = Infinity;
  let departures = 0;
  let worst = "";

  for (let t = 0; t < seconds; t += dt) {
    const before = list.map((s) => s.phase);
    step(list, routes, locks, dt, rnd);
    list.forEach((s, i) => {
      if (before[i] === "depart" && s.phase === "wait") departures++;
      pose(s, routes[i], layout.bays[i].z, layout, poses[i]);
    });
    const circles = poses.map((p) => (p.visible ? bodyCircles(p, layout.truckLen) : []));
    for (let a = 0; a < bays; a++) {
      for (let b = a + 1; b < bays; b++) {
        for (const ca of circles[a])
          for (const cb of circles[b]) {
            const d = Math.hypot(ca[0] - cb[0], ca[1] - cb[1]) - 2 * HALF_W;
            if (d < minGap) {
              minGap = d;
              worst = `t=${t.toFixed(1)} ${a}:${list[a].phase} ${b}:${list[b].phase}`;
            }
          }
      }
      for (const ca of circles[a])
        for (const [x, z] of chargers) minCharger = Math.min(minCharger, Math.hypot(ca[0] - x, ca[1] - z) - HALF_W - 0.45);
    }
  }
  return { minGap, minCharger, departures, worst };
}

describe("trafikken på depotet", () => {
  for (const model of ["rigid", "semi", "bus"] as VehicleModel[]) {
    for (const bays of [1, 3, 6, 8]) {
      test(`${model}, ${bays} plasser: ingen kollisjoner og jevn flyt`, () => {
        for (const dt of [1 / 60, 0.1]) {
          const r = run(model, bays, 30 * 60, dt, 7 + bays);
          expect(r.minGap, r.worst).toBeGreaterThan(0.3);
          expect(r.minCharger).toBeGreaterThan(0.1);
          // Minst én bil i minuttet per plass skal komme gjennom (ingen vranglås).
          expect(r.departures).toBeGreaterThan(bays * 20);
        }
      });
    }
  }
});
