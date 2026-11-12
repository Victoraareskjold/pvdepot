import * as THREE from "three";

/** Fargene i verdenen. Lyst dagslys, kjølig grunn, varme detaljer. */
export const P = {
  sky: "#dfe5f6",
  ground: "#e4e7f3",
  yard: "#d6dbea",
  asphalt: "#9ea7bf",
  asphaltDark: "#8b94ad",
  curb: "#f4f6fb",
  line: "#ffffff",
  lineYellow: "#ffd34d",
  grass: "#bfe3a8",
  grassDark: "#a6d38f",
  tree: "#73c27a",
  treeDark: "#4fa860",
  treeLight: "#9bd68a",
  trunk: "#9a7458",
  wall: "#e8edf8",
  wallRib: "#cbd5ea",
  roof: "#c9d1e3",
  parapet: "#ffffff",
  door: "#2f62d8",
  glass: "#8fb4ec",
  glassDark: "#3c5f9e",
  steel: "#a8b2c8",
  steelDark: "#59637a",
  tire: "#2a2f3c",
  rim: "#c9d0de",
  truckWhite: "#fbfcff",
  forklift: "#ffbe2e",
  pallet: "#d8a265",
  box: "#e9b979",
  boxDark: "#d49c5c",
  charger: "#ffffff",
  charge: "#22c27a",
  chargeDim: "#1a8f5c",
  bay: "#bfe9d3",
  battery: "#f6f8fc",
  transformer: "#ff8a3d",
  cone: "#ff7a3d",
  crane: "#ffc12e",
  hvac: "#dfe4ef",
  car: ["#ff6b6b", "#4d7cff", "#ffffff", "#2f3647", "#22c27a"],
} as const;

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** Gjenbrukte materialer, så hver farge bare kompileres én gang. */
export function mat(color: string, opts: { rough?: number; metal?: number; emissive?: string; ei?: number } = {}) {
  const key = `${color}|${opts.rough ?? 0.8}|${opts.metal ?? 0}|${opts.emissive ?? ""}|${opts.ei ?? 0}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.8,
      metalness: opts.metal ?? 0,
      emissive: opts.emissive ? new THREE.Color(opts.emissive) : undefined,
      emissiveIntensity: opts.ei ?? 0,
    });
    cache.set(key, m);
  }
  return m;
}

export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const CYL = new THREE.CylinderGeometry(1, 1, 1, 20);
export const SPHERE = new THREE.SphereGeometry(1, 20, 14);
export const ROUND_BOX = (() => {
  // Litt avrundet boks gir mykere lys på kanter enn en ren BoxGeometry.
  return new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
})();
