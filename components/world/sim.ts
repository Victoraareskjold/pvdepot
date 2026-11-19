import * as THREE from "three";
import { approachPath, departPath, EASE_D, reversePath, type Layout } from "./layout";
import type { BayState } from "./live";

/**
 * Trafikken på depotet, uten 3D. Brukes av Fleet og av testene.
 *
 * Hver lasterampe har en bil som går i sløyfe: vent, kjør inn langs veien,
 * rygg inn til rampen, koble til, lad, koble fra, vent på fri gård, kjør ut.
 *
 * Trafikkstyring: bare én bil i bevegelse på gården om gangen (inn, rygging
 * eller ut). Rygging mellom parkerte biler er det som oftest går galt i
 * virkeligheten også, så her slipper ingen andre til før bilen står.
 * En bil som kjører ut, slipper gården når den er forbi alle stoppunktene;
 * neste bil kommer bakfra i samme fart og tar den aldri igjen.
 */

export type Phase =
  | "wait"
  | "approach"
  | "reverse"
  | "connect"
  | "charge"
  | "disconnect"
  | "ready"
  | "depart";

export const PHASE_STATE: Record<Phase, BayState> = {
  wait: "ledig",
  approach: "ankommer",
  reverse: "rygger",
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
  approach: Route;
  reverse: Route;
  depart: Route;
}

export interface Locks {
  /** Rampen som har gården, eller −1 */
  yard: number;
}

export const SPEED = 13;
export const REVERSE_SPEED = 3.6;
export const MIN_WAIT = 0.8;

export function buildRoutes(layout: Layout): BayRoutes[] {
  return layout.docks.map((d) => {
    const a = approachPath(d.x, layout);
    const r = reversePath(d.x, layout);
    const o = departPath(d.x, layout);
    return {
      approach: { path: a, length: a.getLength(), clearAt: 0 },
      reverse: { path: r, length: r.getLength(), clearAt: 0 },
      depart: { path: o.path, length: o.path.getLength(), clearAt: o.clearAt },
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

/** Rygging: myk start og stopp. */
const smooth = (k: number) => k * k * (3 - 2 * k);
export const reverseDur = (S: number) => S / REVERSE_SPEED;

/** Ladetiden er lang nok til at de fleste rampene er i bruk mens én bil beveger seg. */
export const chargeTime = (soc: number) => 40 + (1 - soc) * 60;

export function makePlate(i: number) {
  return `EL ${String(10 + ((i * 37) % 89)).padStart(2, "0")}${String((i * 523 + 101) % 1000).padStart(3, "0")}`;
}

function nextPlate(p: string) {
  const num = (parseInt(p.slice(-3), 10) + 137) % 1000;
  return `${p.slice(0, -3)}${String(num).padStart(3, "0")}`;
}

/** Ny rampe: de fleste lader allerede, så scenen er levende fra start. */
export function newSim(i: number, firstFill: boolean, rnd: () => number, reduced: boolean): BaySim {
  const plate = makePlate(i);
  if (firstFill && (reduced || i % 3 !== 1)) {
    const soc = 0.25 + rnd() * 0.65;
    const dur = chargeTime(0.2);
    // Start midt i ladingen, så bilene blir ferdige til ulik tid.
    return { phase: "charge", t: dur * soc, dur, soc, socStart: 0.2, plate };
  }
  return { phase: "wait", t: 0, dur: MIN_WAIT + rnd() * 3, soc: 0.2, socStart: 0.2, plate };
}

/** Ett tidssteg for alle rampene. */
export function step(list: BaySim[], routes: BayRoutes[], lk: Locks, dt: number, rnd: () => number = Math.random) {
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const r = routes[i];
    s.t += dt;

    if (s.phase === "wait" && s.t >= s.dur && lk.yard === -1) {
      s.phase = "approach";
      s.t = 0;
      s.dur = arriveDur(r.approach.length);
      s.socStart = s.soc = 0.15 + rnd() * 0.3;
      lk.yard = i;
    } else if (s.phase === "approach" && s.t >= s.dur) {
      s.phase = "reverse";
      s.t = 0;
      s.dur = reverseDur(r.reverse.length);
    } else if (s.phase === "reverse" && s.t >= s.dur) {
      s.phase = "connect";
      s.t = 0;
      s.dur = 1.4;
      if (lk.yard === i) lk.yard = -1;
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
    } else if (s.phase === "ready" && lk.yard === -1) {
      s.phase = "depart";
      s.t = 0;
      s.dur = departDur(r.depart.length);
      lk.yard = i;
    } else if (s.phase === "depart" && s.t >= s.dur) {
      s.phase = "wait";
      s.t = 0;
      s.dur = MIN_WAIT + rnd() * 4;
      s.plate = nextPlate(s.plate);
      if (lk.yard === i) lk.yard = -1;
    }

    // Bilen som kjører ut, slipper gården når den er forbi alle stoppunktene.
    if (s.phase === "depart" && lk.yard === i && departS(s.t) >= r.depart.clearAt) lk.yard = -1;

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

/** Parkert ved rampen: fronten mot sørvest (+z). */
export const PARKED_YAW = -Math.PI / 2;

export function pose(s: BaySim, r: BayRoutes, dockX: number, layout: Layout, out: Pose): Pose {
  if (s.phase === "wait") {
    out.visible = false;
    return out;
  }
  out.visible = true;
  let route: Route | null = null;
  let dist = 0;
  let backwards = false;
  if (s.phase === "approach") {
    route = r.approach;
    dist = arriveS(s.t, route.length);
  } else if (s.phase === "reverse") {
    route = r.reverse;
    dist = route.length * smooth(Math.min(1, s.t / s.dur));
    backwards = true;
  } else if (s.phase === "depart") {
    route = r.depart;
    dist = departS(s.t);
  }
  if (route) {
    const u = Math.min(1, Math.max(0, dist / route.length));
    route.path.getPointAt(u, _p);
    route.path.getTangentAt(u, _t);
    out.x = _p.x;
    out.z = _p.z;
    // Rygger: bilen peker motsatt av bevegelsen.
    out.yaw = backwards ? Math.atan2(_t.z, -_t.x) : Math.atan2(-_t.z, _t.x);
  } else {
    out.x = dockX;
    out.z = layout.parkZ;
    out.yaw = PARKED_YAW;
  }
  return out;
}
