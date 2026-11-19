import * as THREE from "three";

/**
 * Hvor alt står i verdenen. 1 enhet ≈ 1 meter, men bygget er stilisert
 * (mindre enn virkeligheten) så lastebilene synes.
 *
 * Akser: x mot høyre, z mot kameraet (fremover), y opp.
 * Himmelretning: fasaden (+z) vender mot sørvest, nord er rett opp på
 * skjermen. Lasterampene sitter på fasaden, så bilene og laderne vender
 * også mot sørvest.
 *
 * Lastebilene lader ved lasterampene: de kjører langs veien, stopper
 * forbi rampen sin og rygger inn. Laderen henger på veggen ved porten.
 * Etter lading kjører bilen rett frem ut og videre til høyre.
 * Batteriene står i et rutenett foran til venstre, godt synlig.
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

/** Avstand mellom portene */
export const DOCK_W = 5.4;
export const DOOR_W = 3.4;
/** Bakenden på bilen stopper her (støtfangerne på rampen) */
export const REAR_Z = 0.9;
export const TURN_R = 7;
/** Strekningen bilen bremser inn til stopp eller akselererer ut */
export const EASE_D = 9;
/** Laderen henger på veggen til høyre for porten */
export const CHARGER_DX = DOOR_W / 2 + 0.6;
export const CHARGER_Z = 0.28;

export function truckLength(m: VehicleModel) {
  return m === "semi" ? 14 : m === "bus" ? 12 : 9.5;
}

export function officeWidth(w: number) {
  return Math.min(14, w * 0.3);
}

export interface Layout {
  building: { w: number; d: number; h: number; cx: number; cz: number };
  /** Lasterampene på fasaden, én per ladeplass */
  docks: { x: number }[];
  /** Sentrum av parkert bil (z) */
  parkZ: number;
  /** Der ryggingen går over fra sving til rett linje (z) */
  reverseZ: number;
  laneZ: number;
  roadZ: number;
  truckLen: number;
  /** Sidedører på høyre gavl (gaffeltruckene) */
  sideDoors: { z: number }[];
  battery: { slots: { x: number; z: number }[]; len: number } | null;
  transformer: { x: number; z: number; upgraded: boolean };
  inverter: { x: number; z: number };
  crane: { x: number; z: number };
  forkliftYard: { x0: number; x1: number; z0: number; z1: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  roofSlots: THREE.Vector3[];
  panelSize: { w: number; d: number };
  /** Nøkkel som bare endres når taket endres (paneler nullstilles da) */
  roofKey: string;
}

export function computeLayout(p: WorldParams): Layout {
  const n = Math.max(0, p.bays);
  // Bygget må være bredt nok til kontoret og alle portene.
  const roofW = 30 + Math.sqrt(p.roofM2) * 0.26;
  const needW = 14 + 4 + n * DOCK_W + 4;
  const w = THREE.MathUtils.clamp(Math.max(roofW, needW), 34, 80);
  const d = THREE.MathUtils.clamp(w * 0.42, 18, 28);
  const h = 8.5;
  const building = { w, d, h, cx: 0, cz: -d / 2 };

  const truckLen = truckLength(p.vehicleModel);
  const officeW = officeWidth(w);
  const x0 = -w / 2 + officeW + 4 + DOCK_W / 2;
  const docks = Array.from({ length: n }, (_, i) => ({ x: x0 + i * DOCK_W }));
  const lastX = docks[n - 1]?.x ?? x0;

  const parkZ = REAR_Z + truckLen / 2;
  // Rett rygging minst en billengde inn, så bilen er rett før den går mellom naboene.
  const reverseZ = parkZ + truckLen * 0.75 + 2;
  const laneZ = reverseZ + TURN_R;
  const roadZ = laneZ + 2.2;

  const sideDoors = [{ z: -5 }, { z: -11 }].filter((s) => s.z > -d + 2);

  // Batterier i rutenett på gårdsplassen foran kontoret, rett i synsfeltet.
  // Holder seg til venstre for første rampe og bak kjørefeltet.
  const containers = p.batteryKwh > 0 ? Math.min(6, Math.max(1, Math.ceil(p.batteryKwh / 500))) : 0;
  const len = THREE.MathUtils.clamp(3.5 + p.batteryKwh / 400, 4, 6);
  const battery =
    containers > 0
      ? {
          len,
          slots: Array.from({ length: containers }, (_, i) => ({
            x: -w / 2 + 1.2 + len / 2 + (i % 2) * (len + 1.4),
            z: 6.4 + Math.floor(i / 2) * 3.4,
          })),
        }
      : null;

  const transformer = { x: -w / 2 - 7, z: 2, upgraded: p.gridUpgrade };
  const inverter = { x: w / 2 + 1.3, z: -1.6 };
  const crane = { x: w / 2 + 9, z: 6 };
  const forkliftYard = { x0: w / 2 + 3, x1: w / 2 + 15, z0: -d + 2, z1: -3.5 };

  const bounds = {
    minX: transformer.x - 9,
    maxX: Math.max(w / 2 + 20, crane.x + 8, lastX + TURN_R + truckLen + 4),
    minZ: -d - 4,
    maxZ: roadZ + 7,
  };

  // Plasser til solcellepaneler på taket, fra fronten og bakover.
  const panelSize = { w: 1.1, d: 1.75 };
  const roofSlots: THREE.Vector3[] = [];
  const margin = 1.6;
  const cols = Math.floor((w - margin * 2) / (panelSize.w + 0.12));
  const rowsAvail = Math.floor((d - margin * 2) / (panelSize.d + 0.7));
  const px0 = -((cols - 1) * (panelSize.w + 0.12)) / 2;
  for (let r = 0; r < rowsAvail; r++) {
    const z = -margin - panelSize.d / 2 - r * (panelSize.d + 0.7);
    for (let c = 0; c < cols; c++) {
      const x = px0 + c * (panelSize.w + 0.12);
      if (isHvac(x, z, w, d)) continue;
      roofSlots.push(new THREE.Vector3(x, h + 0.55, z));
    }
  }

  return {
    building,
    docks,
    parkZ,
    reverseZ,
    laneZ,
    roadZ,
    truckLen,
    sideDoors,
    battery,
    transformer,
    inverter,
    crane,
    forkliftYard,
    bounds,
    roofSlots,
    panelSize,
    roofKey: `${w.toFixed(2)}x${d.toFixed(2)}`,
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

const v = (x: number, z: number) => new THREE.Vector3(x, 0, z);

/** Inn langs veien fra venstre til stoppunktet like forbi rampen. Kjøres forover. */
export function approachPath(dockX: number, l: Layout) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(new THREE.LineCurve3(v(l.bounds.minX - 40, l.laneZ), v(dockX + TURN_R, l.laneZ)));
  return path;
}

/**
 * Rygging inn til rampen: fra stoppunktet svinger bakenden inn mot porten,
 * så rett bakover til støtfangerne. Kurven beskriver bevegelsen; bilen
 * peker motsatt vei.
 */
export function reversePath(dockX: number, l: Layout) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(
    new THREE.QuadraticBezierCurve3(v(dockX + TURN_R, l.laneZ), v(dockX, l.laneZ), v(dockX, l.reverseZ)),
  );
  path.add(new THREE.LineCurve3(v(dockX, l.reverseZ), v(dockX, l.parkZ)));
  return path;
}

/**
 * Ut: rett frem fra rampen, sving til høyre ut på veien og videre.
 * clearAt er strekningen der bilen er forbi alle stoppunktene, så neste
 * bil kan slippes inn uten å ta den igjen.
 */
export function departPath(dockX: number, l: Layout) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(new THREE.LineCurve3(v(dockX, l.parkZ), v(dockX, l.reverseZ)));
  path.add(
    new THREE.QuadraticBezierCurve3(v(dockX, l.reverseZ), v(dockX, l.laneZ), v(dockX + TURN_R, l.laneZ)),
  );
  const onRoad = path.getLength();
  const lastX = l.docks[l.docks.length - 1]?.x ?? dockX;
  const clearX = lastX + TURN_R + l.truckLen + 3;
  path.add(new THREE.LineCurve3(v(dockX + TURN_R, l.laneZ), v(l.bounds.maxX + 40, l.laneZ)));
  return { path, clearAt: onRoad + Math.max(0, clearX - (dockX + TURN_R)) };
}
