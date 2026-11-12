import * as THREE from "three";
import { arrivalPath, departPath, EASE_D, type Layout } from "./layout";
import type { BayState } from "./live";

/**
 * Trafikken på depotet, uten 3D. Brukes av Fleet og av testene.
 *
 * Hver ladeplass har en bil som går i sløyfe: vent, kjør inn, koble til,
 * lad, koble fra, vent på fri utkjøring, kjør ut. Bare én bil i
 * innkjøringen og én i utkjøringen om gangen. Bilene holder fast fart på
 * delte strekninger og bremser/akselererer bare i sin egen rad.
 */

export type Phase = "wait" | "arrive" | "connect" | "charge" | "disconnect" | "ready" | "depart";

export const PHASE_STATE: Record<Phase, BayState> = {
  wait: "ledig",
  arrive: "ankommer",
  connect: "kobler",
  charge: "lader",
  disconnect: "ferdig",
  ready: "ferdig",
  depart: "kjorer",
};

export interface BaySim {
  phase: Phase;
  t: number;
  dur: number;
  soc: number;
  socStart: number;
  plate: string;
}

export interface Route {
  path: THREE.CurvePath<THREE.Vector3>;
  length: number;
  clearAt: number;
}

export interface BayRoutes {
  arrive: Route;
  depart: Route;
}

export interface Locks {
  entry: number;
  exit: number;
}

export const SPEED = 13;
export const MIN_WAIT = 0.8;

export function buildRoutes(layout: Layout): BayRoutes[] {
  return layout.bays.map((b) => {
    const a = arrivalPath(b.z, layout);
    const d = departPath(b.z, layout);
    return {
      arrive: { path: a.path, length: a.path.getLength(), clearAt: a.clearAt },
      depart: { path: d.path, length: d.path.getLength(), clearAt: d.clearAt },
    };
  });
}

/** Strekning ved tid t: fast fart, bremser de siste EASE_D. */
export function arriveS(t: number, S: number) {
  const t1 = (S - EASE_D) / SPEED;
  if (t <= t1) return SPEED * t;
  const tau = Math.min(t - t1, (2 * EASE_D) / SPEED);
  return S - EASE_D + SPEED * tau - ((SPEED * SPEED) / (4 * EASE_D)) * tau * tau;
}
export const arriveDur = (S: number) => (S - EASE_D) / SPEED + (2 * EASE_D) / SPEED;

/** Akselererer de første EASE_D, deretter fast fart. */
export function departS(t: number) {
  const t1 = (2 * EASE_D) / SPEED;
  if (t <= t1) return ((SPEED * SPEED) / (4 * EASE_D)) * t * t;
  return EASE_D + SPEED * (t - t1);
}
export const departDur = (S: number) => (2 * EASE_D) / SPEED + (S - EASE_D) / SPEED;

export const chargeTime = (soc: number) => 6 + (1 - soc) * 14;

export function makePlate(i: number) {
  return `EL ${String(10 + ((i * 37) % 89)).padStart(2, "0")}${String((i * 523 + 101) % 1000).padStart(3, "0")}`;
}

function nextPlate(p: string) {
  const num = (parseInt(p.slice(-3), 10) + 137) % 1000;
  return `${p.slice(0, -3)}${String(num).padStart(3, "0")}`;
}

/** Ny plass: de første lader allerede, så scenen er levende fra start. */
export function newSim(i: number, firstFill: boolean, rnd: () => number, reduced: boolean): BaySim {
  const plate = makePlate(i);
  if (firstFill && (reduced || i % 3 !== 2)) {
    const soc = 0.3 + rnd() * 0.5;
    return { phase: "charge", t: 0, dur: chargeTime(soc), soc, socStart: soc, plate };
  }
  return { phase: "wait", t: 0, dur: MIN_WAIT + rnd() * 3, soc: 0.2, socStart: 0.2, plate };
}

/** Ett tidssteg for alle plassene. */
export function step(list: BaySim[], routes: BayRoutes[], lk: Locks, dt: number, rnd: () => number = Math.random) {
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const r = routes[i];
    s.t += dt;

    if (s.phase === "wait" && s.t >= s.dur && lk.entry === -1) {
      s.phase = "arrive";
      s.t = 0;
      s.dur = arriveDur(r.arrive.length);
      s.socStart = s.soc = 0.15 + rnd() * 0.3;
      lk.entry = i;
    } else if (s.phase === "arrive" && s.t >= s.dur) {
      s.phase = "connect";
      s.t = 0;
      s.dur = 1.4;
      if (lk.entry === i) lk.entry = -1;
    } else if (s.phase === "connect" && s.t >= s.dur) {
      s.phase = "charge";
      s.t = 0;
      s.dur = chargeTime(s.soc);
      s.socStart = s.soc;
    } else if (s.phase === "charge" && s.t >= s.dur) {
      s.phase = "disconnect";
      s.t = 0;
      s.dur = 1.1;
      s.soc = 1;
    } else if (s.phase === "disconnect" && s.t >= s.dur) {
      s.phase = "ready";
      s.t = 0;
    } else if (s.phase === "ready" && lk.exit === -1) {
      s.phase = "depart";
      s.t = 0;
      s.dur = departDur(r.depart.length);
      lk.exit = i;
    } else if (s.phase === "depart" && s.t >= s.dur) {
      s.phase = "wait";
      s.t = 0;
      s.dur = MIN_WAIT + rnd() * 3;
      s.plate = nextPlate(s.plate);
      if (lk.exit === i) lk.exit = -1;
    }

    // Slipp låsene så snart bilen er ute av den delte strekningen.
    if (s.phase === "arrive" && lk.entry === i && arriveS(s.t, r.arrive.length) >= r.arrive.clearAt) lk.entry = -1;
    if (s.phase === "depart" && lk.exit === i && departS(s.t) >= r.depart.clearAt) lk.exit = -1;

    if (s.phase === "charge") s.soc = s.socStart + (1 - s.socStart) * Math.min(1, s.t / s.dur);
  }
}

export interface Pose {
  visible: boolean;
  x: number;
  z: number;
  /** Retning bilen peker (rotation.y; 0 = mot +x) */
  yaw: number;
}

const _p = new THREE.Vector3();
const _t = new THREE.Vector3();

export function pose(s: BaySim, r: BayRoutes, rowZ: number, layout: Layout, out: Pose): Pose {
  if (s.phase === "wait") {
    out.visible = false;
    return out;
  }
  out.visible = true;
  if (s.phase === "arrive" || s.phase === "depart") {
    const route = s.phase === "arrive" ? r.arrive : r.depart;
    const dist = s.phase === "arrive" ? arriveS(s.t, route.length) : departS(s.t);
    const u = Math.min(1, Math.max(0, dist / route.length));
    route.path.getPointAt(u, _p);
    route.path.getTangentAt(u, _t);
    out.x = _p.x;
    out.z = _p.z;
    out.yaw = Math.atan2(-_t.z, _t.x);
  } else {
    out.x = layout.xPark;
    out.z = rowZ;
    out.yaw = 0;
  }
  return out;
}
