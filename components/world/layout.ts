import * as THREE from "three";

/**
 * Hvor alt står i verdenen. 1 enhet ≈ 1 meter, men bygget er stilisert
 * (mindre enn virkeligheten) så lastebilene synes.
 *
 * Akser: x mot høyre, z mot kameraet (fremover), y opp. Fasaden peker mot +z.
 * Ladeplassene står foran bygget, veien går langs fronten, lasterampene
 * er på høyre gavl.
 */

export type VehicleModel = "rigid" | "semi" | "bus";

export interface WorldParams {
  bays: number;
  vehicleModel: VehicleModel;
  roofM2: number;
  solarCoverage: number;
  batteryKwh: number;
  gridUpgrade: boolean;
  chargerKw: number;
}

export const BAY_W = 5.6;
export const CHARGER_Z = 3.6;
export const TURN_R = 8;

export function truckLength(m: VehicleModel) {
  return m === "semi" ? 14 : m === "bus" ? 12 : 9.5;
}

export interface Layout {
  building: { w: number; d: number; h: number; cx: number; cz: number };
  bays: { x: number }[];
  parkZ: number;
  laneZ: number;
  roadZ: number;
  truckLen: number;
  docks: { z: number }[];
  battery: { x: number; z: number; containers: number; scale: number } | null;
  transformer: { x: number; z: number; upgraded: boolean };
  crane: { x: number; z: number };
  forkliftYard: { x0: number; x1: number; z0: number; z1: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  roofSlots: THREE.Vector3[];
  panelSize: { w: number; d: number };
}

export function computeLayout(p: WorldParams): Layout {
  const w = THREE.MathUtils.clamp(30 + Math.sqrt(p.roofM2) * 0.26, 34, 66);
  const d = THREE.MathUtils.clamp(w * 0.46, 18, 28);
  const h = 8.5;
  const building = { w, d, h, cx: 0, cz: -d / 2 };

  const n = Math.max(0, p.bays);
  const span = n * BAY_W;
  // Ladeplassene sentreres litt mot venstre, så høyre side er fri for lasterampene.
  const bayStart = -span / 2 + BAY_W / 2 - 2;
  const bays = Array.from({ length: n }, (_, i) => ({ x: bayStart + i * BAY_W }));

  const truckLen = truckLength(p.vehicleModel);
  const parkZ = CHARGER_Z + 1.6 + truckLen / 2;
  const laneZ = CHARGER_Z + 1.6 + truckLen + TURN_R + 1;
  const roadZ = laneZ + 2.2;

  const docks: { z: number }[] = [];
  for (let z = -4; z > -d + 3; z -= 5.5) docks.push({ z });

  const leftEdge = Math.min(bays[0]?.x ?? 0, -w / 2) - BAY_W;
  const containers = p.batteryKwh > 0 ? Math.min(4, Math.max(1, Math.ceil(p.batteryKwh / 800))) : 0;
  const battery =
    containers > 0
      ? { x: leftEdge - 4, z: 4, containers, scale: THREE.MathUtils.clamp(0.6 + p.batteryKwh / 2000, 0.6, 1) }
      : null;
  const transformer = { x: leftEdge - 4, z: -5, upgraded: p.gridUpgrade };
  // Kranen står foran høyre hjørne, der kameraet ser den.
  const crane = { x: Math.max(w / 2 + 7, (bays[n - 1]?.x ?? 0) + 10), z: 7 };

  const forkliftYard = { x0: w / 2 + 3, x1: w / 2 + 15, z0: -d + 2, z1: -2 };

  const bounds = {
    minX: leftEdge - 12,
    maxX: Math.max(w / 2 + 20, (bays[n - 1]?.x ?? 0) + BAY_W, crane.x + 8),
    minZ: -d - 4,
    maxZ: roadZ + 7,
  };

  // Plasser til solcellepaneler på taket, fra fronten og bakover.
  const panelSize = { w: 1.1, d: 1.75 };
  const roofSlots: THREE.Vector3[] = [];
  const margin = 1.6;
  const cols = Math.floor((w - margin * 2) / (panelSize.w + 0.12));
  const rowsAvail = Math.floor((d - margin * 2) / (panelSize.d + 0.7));
  const x0 = -((cols - 1) * (panelSize.w + 0.12)) / 2;
  for (let r = 0; r < rowsAvail; r++) {
    const z = -margin - panelSize.d / 2 - r * (panelSize.d + 0.7);
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * (panelSize.w + 0.12);
      // Hold av plass til takaggregatene.
      if (isHvac(x, z, w, d)) continue;
      roofSlots.push(new THREE.Vector3(x, h + 0.55, z));
    }
  }

  return {
    building,
    bays,
    parkZ,
    laneZ,
    roadZ,
    truckLen,
    docks,
    battery,
    transformer,
    crane,
    forkliftYard,
    bounds,
    roofSlots,
    panelSize,
  };
}

export function hvacUnits(w: number, d: number) {
  return [
    { x: w * 0.3, z: -d * 0.72, sx: 3.2, sz: 2.2 },
    { x: w * 0.38, z: -d * 0.72, sx: 2.2, sz: 2.2 },
    { x: -w * 0.34, z: -d * 0.8, sx: 2.6, sz: 2 },
  ];
}

function isHvac(x: number, z: number, w: number, d: number) {
  return hvacUnits(w, d).some((u) => Math.abs(x - u.x) < u.sx / 2 + 0.9 && Math.abs(z - u.z) < u.sz / 2 + 1.2);
}

/** Kjørerute inn til en ladeplass: langs veien, sving inn, frem til laderen. */
export function arrivalPath(bayX: number, l: Layout) {
  const start = new THREE.Vector3(l.bounds.minX - 30, 0, l.laneZ);
  const beforeTurn = new THREE.Vector3(bayX - TURN_R, 0, l.laneZ);
  const afterTurn = new THREE.Vector3(bayX, 0, l.laneZ - TURN_R);
  const park = new THREE.Vector3(bayX, 0, l.parkZ);
  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(new THREE.LineCurve3(start, beforeTurn));
  path.add(new THREE.QuadraticBezierCurve3(beforeTurn, new THREE.Vector3(bayX, 0, l.laneZ), afterTurn));
  path.add(new THREE.LineCurve3(afterTurn, park));
  return path;
}

/** Rygger ut fra plassen og svinger slik at bilen peker mot høyre på veien. */
export function reversePath(bayX: number, l: Layout) {
  const park = new THREE.Vector3(bayX, 0, l.parkZ);
  const beforeTurn = new THREE.Vector3(bayX, 0, l.laneZ - TURN_R);
  const end = new THREE.Vector3(bayX - TURN_R, 0, l.laneZ);
  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(new THREE.LineCurve3(park, beforeTurn));
  path.add(new THREE.QuadraticBezierCurve3(beforeTurn, new THREE.Vector3(bayX, 0, l.laneZ), end));
  return path;
}

/** Kjører ut til høyre langs veien. */
export function departPath(bayX: number, l: Layout) {
  const from = new THREE.Vector3(bayX - TURN_R, 0, l.laneZ);
  const to = new THREE.Vector3(l.bounds.maxX + 34, 0, l.laneZ);
  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(new THREE.LineCurve3(from, to));
  return path;
}
