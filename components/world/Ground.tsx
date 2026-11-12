"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { B, C, S } from "./parts";
import { P } from "./palette";
import type { Layout } from "./layout";

/** Grunn, gårdsplass, vei, gress, trær, lyktestolper og parkerte biler. */
export default function Ground({ layout, rich }: { layout: Layout; rich: boolean }) {
  const { bounds, roadZ, building } = layout;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const yardW = bounds.maxX - bounds.minX;

  const dashes = useMemo(() => {
    const out: number[] = [];
    for (let x = bounds.minX - 60; x < bounds.maxX + 60; x += 5) out.push(x);
    return out;
  }, [bounds.minX, bounds.maxX]);

  const trees = useMemo(() => {
    // Fast «tilfeldig» plassering, så trærne ikke hopper ved endringer.
    const rnd = mulberry(7);
    const out: { x: number; z: number; s: number; tone: number }[] = [];
    for (let x = bounds.minX - 30; x < bounds.maxX + 30; x += 9 + rnd() * 8) {
      out.push({ x, z: roadZ + 12 + rnd() * 6, s: 1.1 + rnd() * 0.8, tone: rnd() });
    }
    for (let z = building.cz - building.d / 2 - 2; z < roadZ - 4; z += 7 + rnd() * 4) {
      out.push({ x: bounds.minX - 6 - rnd() * 6, z, s: 1.5 + rnd() * 1.2, tone: rnd() });
    }
    for (let x = bounds.minX; x < bounds.maxX; x += 8 + rnd() * 6) {
      out.push({ x, z: -building.d - 7 - rnd() * 5, s: 1.8 + rnd() * 1.6, tone: rnd() });
    }
    return out;
  }, [bounds.minX, bounds.maxX, roadZ, building.cz, building.d]);

  return (
    <group>
      {/* Grunnflate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.02, 0]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color={P.ground} roughness={1} />
      </mesh>
      {/* Gressbelter foran veien og bak bygget */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.01, roadZ + 13]} receiveShadow>
        <planeGeometry args={[600, 16]} />
        <meshStandardMaterial color={P.grass} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.01, -building.d - 8]} receiveShadow>
        <planeGeometry args={[600, 9]} />
        <meshStandardMaterial color={P.grass} roughness={1} />
      </mesh>

      {/* Gårdsplass (lys asfalt) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, (bounds.minZ + roadZ - 4.6) / 2]} receiveShadow>
        <planeGeometry args={[yardW + 8, roadZ - 4.6 - bounds.minZ + 2]} />
        <meshStandardMaterial color={P.yard} roughness={0.95} />
      </mesh>

      {/* Vei */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.01, roadZ]} receiveShadow>
        <planeGeometry args={[600, 9]} />
        <meshStandardMaterial color={P.asphalt} roughness={0.95} />
      </mesh>
      {dashes.map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.03, roadZ]}>
          <planeGeometry args={[2.4, 0.22]} />
          <meshBasicMaterial color={P.line} />
        </mesh>
      ))}
      {/* Fortauskanter */}
      <B p={[cx, 0.08, roadZ - 4.6]} s={[600, 0.16, 0.35]} c={P.curb} shadow={false} />
      <B p={[cx, 0.08, roadZ + 4.6]} s={[600, 0.16, 0.35]} c={P.curb} shadow={false} />
      {/* Gul kantlinje inn mot gården */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.03, roadZ - 4.1]}>
        <planeGeometry args={[600, 0.16]} />
        <meshBasicMaterial color={P.lineYellow} />
      </mesh>

      {/* Gressbed foran kontoret */}
      <B p={[-building.w / 2 + 3, 0.12, 2.8]} s={[5, 0.24, 1.4]} c={P.grassDark} shadow={false} />

      {trees.map((t, i) => (
        <Tree key={i} x={t.x} z={t.z} s={t.s} tone={t.tone} />
      ))}


      {rich && <ParkedCars x={-building.w / 2 - 1} z={-building.d - 1.5} />}
    </group>
  );
}

function Tree({ x, z, s, tone }: { x: number; z: number; s: number; tone: number }) {
  const color = tone < 0.33 ? P.tree : tone < 0.66 ? P.treeDark : P.treeLight;
  return (
    <group position={[x, 0, z]}>
      <C p={[0, s * 0.6, 0]} s={[0.18 * s, s * 1.2, 0.18 * s]} c={P.trunk} />
      <S p={[0, s * 1.65, 0]} s={[s, s * 1.05, s]} c={color} />
      <S p={[s * 0.35, s * 1.25, s * 0.2]} s={[s * 0.6, s * 0.6, s * 0.6]} c={color} />
    </group>
  );
}


function ParkedCars({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {[0, 1, 2, 3].map((i) => (
        <Car key={i} position={[i * 3, 0, 0]} color={P.car[i % P.car.length]} />
      ))}
    </group>
  );
}

function Car({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <B p={[0, 0.55, 0]} s={[1.8, 0.7, 4.2]} c={color} rough={0.35} />
      <B p={[0, 1.1, -0.2]} s={[1.6, 0.55, 2.2]} c={P.glassDark} rough={0.2} />
      {[-1.4, 1.4].map((zz) =>
        [-0.85, 0.85].map((xx) => (
          <C key={`${zz}${xx}`} p={[xx, 0.32, zz]} s={[0.32, 0.25, 0.32]} r={[0, 0, Math.PI / 2]} c={P.tire} />
        )),
      )}
    </group>
  );
}

/* ------------------- Lasteområdet med gaffeltrucker ------------------- */

export function DockYard({ layout }: { layout: Layout }) {
  const { forkliftYard: y, docks, building } = layout;
  const stacks = useMemo(() => {
    const rnd = mulberry(3);
    const out: { x: number; z: number; h: number }[] = [];
    for (let z = y.z0 + 1; z < y.z1; z += 2.4) {
      for (let x = y.x1 - 3; x < y.x1; x += 1.6) out.push({ x, z, h: 1 + Math.floor(rnd() * 3) });
    }
    return out;
  }, [y.x1, y.z0, y.z1]);

  return (
    <group>
      {/* Gul oppmerking rundt lasteområdet */}
      {[y.x0, y.x1].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.025, (y.z0 + y.z1) / 2]}>
          <planeGeometry args={[0.18, y.z1 - y.z0]} />
          <meshBasicMaterial color={P.lineYellow} />
        </mesh>
      ))}
      {stacks.map((s, i) => (
        <PalletStack key={i} x={s.x} z={s.z} levels={s.h} />
      ))}
      {docks.slice(0, 3).map((d, i) => (
        <Forklift
          key={i}
          from={[building.w / 2 + 3.6, d.z]}
          to={[y.x1 - 4.2, stacks[(i * 3) % Math.max(1, stacks.length)]?.z ?? d.z]}
          offset={i * 2.3}
        />
      ))}
      {/* Kjegler */}
      {[0, 1, 2].map((i) => (
        <C key={i} p={[y.x0 + 0.6 + i * 1.2, 0.35, y.z1 + 1]} s={[0.22, 0.7, 0.22]} c={P.cone} />
      ))}
    </group>
  );
}

function PalletStack({ x, z, levels }: { x: number; z: number; levels: number }) {
  return (
    <group position={[x, 0, z]}>
      <B p={[0, 0.08, 0]} s={[1.2, 0.16, 1.2]} c={P.pallet} />
      {Array.from({ length: levels }, (_, k) => (
        <B key={k} p={[0, 0.5 + k * 0.62, 0]} s={[1.1, 0.6, 1.1]} c={k % 2 ? P.boxDark : P.box} />
      ))}
    </group>
  );
}

/** Gaffeltruck som henter paller ved porten og kjører dem til stablene. */
function Forklift({ from, to, offset }: { from: [number, number]; to: [number, number]; offset: number }) {
  const g = useRef<THREE.Group>(null);
  const forks = useRef<THREE.Group>(null);
  const load = useRef<THREE.Group>(null);
  const a = useMemo(() => new THREE.Vector3(from[0], 0, from[1]), [from]);
  const b = useMemo(() => new THREE.Vector3(to[0], 0, to[1]), [to]);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    if (!g.current) return;
    // Syklus: kjør ut med last, løft, slipp, kjør tilbake tom, hent ny.
    const T = 9;
    const t = ((clock.elapsedTime + offset) % T) / T;
    let k: number;
    let loaded: boolean;
    let lift = 0;
    if (t < 0.4) {
      k = ease(t / 0.4);
      loaded = true;
    } else if (t < 0.5) {
      k = 1;
      loaded = t < 0.47;
      lift = Math.sin(((t - 0.4) / 0.1) * Math.PI) * 0.9;
    } else if (t < 0.9) {
      k = 1 - ease((t - 0.5) / 0.4);
      loaded = false;
    } else {
      k = 0;
      loaded = t > 0.95;
      lift = Math.sin(((t - 0.9) / 0.1) * Math.PI) * 0.4;
    }
    tmp.lerpVectors(a, b, k);
    g.current.position.copy(tmp);
    // Gaflene peker alltid mot stablene; tilbake rygger trucken.
    g.current.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
    if (forks.current) forks.current.position.y = 0.25 + lift;
    if (load.current) load.current.visible = loaded;
  });

  return (
    <group ref={g}>
      <B p={[0, 0.6, 0]} s={[1.6, 0.8, 1.1]} c={P.forklift} rough={0.5} />
      <B p={[-0.5, 0.9, 0]} s={[0.6, 0.8, 1.05]} c="#2c3346" />
      {/* Førerhus-bøyle */}
      <B p={[0.1, 1.9, 0.48]} s={[0.08, 1.4, 0.08]} c="#2c3346" />
      <B p={[0.1, 1.9, -0.48]} s={[0.08, 1.4, 0.08]} c="#2c3346" />
      <B p={[0.1, 2.6, 0]} s={[1, 0.08, 1.05]} c="#2c3346" />
      {/* Mast */}
      <B p={[0.9, 1.4, 0.35]} s={[0.1, 2.6, 0.1]} c={P.steelDark} />
      <B p={[0.9, 1.4, -0.35]} s={[0.1, 2.6, 0.1]} c={P.steelDark} />
      <group ref={forks}>
        <B p={[1.4, 0, 0.3]} s={[1, 0.06, 0.12]} c={P.steelDark} />
        <B p={[1.4, 0, -0.3]} s={[1, 0.06, 0.12]} c={P.steelDark} />
        <group ref={load}>
          <B p={[1.45, 0.1, 0]} s={[1.1, 0.14, 1.1]} c={P.pallet} />
          <B p={[1.45, 0.5, 0]} s={[1, 0.65, 1]} c={P.box} />
        </group>
      </group>
      {[-0.5, 0.55].map((x) =>
        [-0.5, 0.5].map((z) => (
          <C key={`${x}${z}`} p={[x, 0.25, z]} s={[0.25, 0.2, 0.25]} r={[Math.PI / 2, 0, 0]} c={P.tire} />
        )),
      )}
    </group>
  );
}

export const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
