import * as THREE from "three";

/**
 * Hvor alt står i verdenen. 1 enhet ≈ 1 meter, men bygget er stilisert
 * (mindre enn virkeligheten) så lastebilene synes.
 *
 * Akser: x mot høyre, z mot kameraet (fremover), y opp. Fasaden peker mot +z.
 *
 * Ladeplassene er gjennomkjøringsrader foran bygget, parallelt med fasaden:
 * bilene svinger inn fra veien i innkjøringen til venstre, kjører langs
 * raden til DC-laderen ved fronten, og kjører rett ut til høyre etter
 * lading. Ingen rygging og ingen møtende trafikk. Batteriene står i et
 * rutenett til venstre for bygget, inverter og styring på høyre hjørne.
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

/** Avstand mellom radene */
export const ROW_W = 5.6;
/** Første rad (nærmest bygget) */
export const ROW0_Z = 7;
export const TURN_R = 7;
/** Strekningen bilen bruker på å bremse inn til laderen eller akselerere ut */
export const EASE_D = 9;
/** Laderen står ved fronten, på byggsiden av raden */
export const CHARGER_SIDE = -2.3;

export function truckLength(m: VehicleModel) {
  return m === "semi" ? 14 : m === "bus" ? 12 : 9.5;
}

export interface Layout {
  building: { w: number; d: number; h: number; cx: number; cz: number };
  /** Ladeplasser: én rad per plass */
  bays: { z: number }[];
  /** Innkjøringen (x), parkering (sentrum av bilen), lader og utkjøringen */
  xIn: number;
  xPark: number;
  chargerX: number;
  xOut: number;
  laneZ: number;
  roadZ: number;
  truckLen: number;
  docks: { z: number }[];
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
  const w = THREE.MathUtils.clamp(30 + Math.sqrt(p.roofM2) * 0.26, 34, 66);
  const d = THREE.MathUtils.clamp(w * 0.46, 18, 28);
  const h = 8.5;
  const building = { w, d, h, cx: 0, cz: -d / 2 };

  const truckLen = truckLength(p.vehicleModel);
  const n = Math.max(0, p.bays);
  const bays = Array.from({ length: n }, (_, i) => ({ z: ROW0_Z + i * ROW_W }));
  const lastZ = bays[n - 1]?.z ?? ROW0_Z;

  // Raden: sving inn, halen fri av innkjøringen før bremsing, lader, utkjøring.
  // Utkjøringssvingen starter først når hele bilen er forbi laderen, ellers sveiper halen inn i den.
  const rowSpan = TURN_R + truckLen + EASE_D + 1 + truckLen / 2 + 0.4 + truckLen / 2 + 2 + TURN_R;
  const xIn = -rowSpan / 2 - 2;
  const xPark = xIn + TURN_R + truckLen / 2 + EASE_D + 1;
  const chargerX = xPark + truckLen / 2 + 0.4;
  const xOut = chargerX + truckLen / 2 + 2 + TURN_R;

  const laneZ = lastZ + TURN_R * 2 + 1;
  const roadZ = laneZ + 2.2;

  const docks: { z: number }[] = [];
  for (let z = -4; z > -d + 3; z -= 5.5) docks.push({ z });

  // Batterier i rutenett (to kolonner) til venstre for bygget, som i skissen.
  const containers = p.batteryKwh > 0 ? Math.min(6, Math.max(1, Math.ceil(p.batteryKwh / 500))) : 0;
  const len = THREE.MathUtils.clamp(3.5 + p.batteryKwh / 400, 4, 6);
  const battery =
    containers > 0
      ? {
          len,
          slots: Array.from({ length: containers }, (_, i) => ({
            x: -w / 2 - 3.5 - len / 2 - (i % 2) * (len + 1.4),
            z: -3 - Math.floor(i / 2) * 3.4,
          })),
        }
      : null;

  const batteryLeft = battery ? -w / 2 - 3.5 - len * 2 - 1.4 : -w / 2;
  const transformer = { x: Math.min(batteryLeft, -w / 2 - 4) - 5, z: 3, upgraded: p.gridUpgrade };
  const inverter = { x: w / 2 - 1.2, z: 0.9 };
  const crane = { x: Math.max(w / 2 + 8, xOut + TURN_R + 7), z: 5 };
  const forkliftYard = { x0: w / 2 + 3, x1: w / 2 + 15, z0: -d + 2, z1: -2 };

  const bounds = {
    minX: Math.min(transformer.x - 8, xIn - TURN_R - 6),
    maxX: Math.max(w / 2 + 20, crane.x + 8, xOut + TURN_R + 4),
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
      if (isHvac(x, z, w, d)) continue;
      roofSlots.push(new THREE.Vector3(x, h + 0.55, z));
    }
  }

  return {
    building,
    bays,
    xIn,
    xPark,
    chargerX,
    xOut,
    laneZ,
    roadZ,
    truckLen,
    docks,
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

/**
 * Inn: langs veien fra venstre, opp innkjøringen, sving inn i raden og frem
 * til laderen. Returnerer ruten og hvor langt det er til innkjøringen er
 * forlatt (da kan neste bil slippes inn).
 */
export function arrivalPath(rowZ: number, l: Layout) {
  const R = TURN_R;
  const path = new THREE.CurvePath<THREE.Vector3>();
  const start = v(l.bounds.minX - 40, l.laneZ);
  path.add(new THREE.LineCurve3(start, v(l.xIn - R, l.laneZ)));
  path.add(new THREE.QuadraticBezierCurve3(v(l.xIn - R, l.laneZ), v(l.xIn, l.laneZ), v(l.xIn, l.laneZ - R)));
  if (l.laneZ - R > rowZ + R + 0.01) path.add(new THREE.LineCurve3(v(l.xIn, l.laneZ - R), v(l.xIn, rowZ + R)));
  path.add(new THREE.QuadraticBezierCurve3(v(l.xIn, rowZ + R), v(l.xIn, rowZ), v(l.xIn + R, rowZ)));
  const beforeRow = path.getLength();
  path.add(new THREE.LineCurve3(v(l.xIn + R, rowZ), v(l.xPark, rowZ)));
  // Halen er ute av innkjøringen når bilen har kjørt en billengde inn i raden.
  return { path, clearAt: beforeRow + l.truckLen / 2 + 1.5 };
}

/** Ut: rett frem forbi laderen, ned utkjøringen og videre til høyre. */
export function departPath(rowZ: number, l: Layout) {
  const R = TURN_R;
  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(new THREE.LineCurve3(v(l.xPark, rowZ), v(l.xOut - R, rowZ)));
  const enterAisle = path.getLength();
  path.add(new THREE.QuadraticBezierCurve3(v(l.xOut - R, rowZ), v(l.xOut, rowZ), v(l.xOut, rowZ + R)));
  if (l.laneZ - R > rowZ + R + 0.01) path.add(new THREE.LineCurve3(v(l.xOut, rowZ + R), v(l.xOut, l.laneZ - R)));
  path.add(new THREE.QuadraticBezierCurve3(v(l.xOut, l.laneZ - R), v(l.xOut, l.laneZ), v(l.xOut + R, l.laneZ)));
  const onRoad = path.getLength();
  path.add(new THREE.LineCurve3(v(l.xOut + R, l.laneZ), v(l.bounds.maxX + 40, l.laneZ)));
  // Utkjøringen er fri når halen er kommet et stykke ut på veien.
  return { path, enterAisle, clearAt: onRoad + l.truckLen + 2 };
}
