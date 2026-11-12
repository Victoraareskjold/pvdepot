"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { B, C } from "./parts";
import { P } from "./palette";
import { CHARGER_Z, type Layout } from "./layout";
import { live } from "./live";

/**
 * Strømmen til laderne: nettstasjon (ny trafo ved behov), batteri og
 * solceller. Lysende pakker viser hvor strømmen kommer fra mens bilene lader.
 */
export default function Energy({ layout, accent, energy, hasSolar }: { layout: Layout; accent: string; energy: string; hasSolar: boolean }) {
  const { transformer: tr, battery: bat, bays, building } = layout;
  const lastX = (bays[bays.length - 1]?.x ?? 0) + 2;
  const firstX = (bays[0]?.x ?? 0) - 2;

  const flows = useMemo(() => {
    const out: { color: string; pts: THREE.Vector3[]; on: () => boolean }[] = [];
    const v = (x: number, z: number) => new THREE.Vector3(x, 0.12, z);
    out.push({
      color: accent,
      pts: [v(tr.x, tr.z), v(tr.x, CHARGER_Z - 1.6), v(lastX, CHARGER_Z - 1.6)],
      on: () => true,
    });
    if (hasSolar) {
      const ix = -building.w / 2 + 16.5;
      out.push({
        color: energy,
        pts: [v(ix, 0.5), v(ix, CHARGER_Z - 1.15), v(lastX, CHARGER_Z - 1.15)].map((p) => p),
        on: () => true,
      });
    }
    if (bat) {
      out.push({
        color: P.charge,
        pts: [v(bat.x, bat.z), v(bat.x, CHARGER_Z - 0.7), v(lastX, CHARGER_Z - 0.7)],
        on: () => true,
      });
    }
    return out;
  }, [tr.x, tr.z, lastX, hasSolar, bat, building.w, accent, energy]);

  return (
    <group>
      {flows.map((f, i) => (
        <Flow key={i} points={f.pts} color={f.color} />
      ))}
      <Substation x={tr.x} z={tr.z} upgraded={tr.upgraded} accent={accent} />
      {bat && <Battery x={bat.x} z={bat.z} count={bat.containers} scale={bat.scale} />}
      {void firstX}
    </group>
  );
}

function Flow({ points, color }: { points: THREE.Vector3[]; color: string }) {
  const curve = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < points.length - 1; i++) path.add(new THREE.LineCurve3(points[i], points[i + 1]));
    return path;
  }, [points]);
  const length = curve.getLength();
  const count = Math.max(4, Math.floor(length / 2.2));
  const ref = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const p = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const im = ref.current;
    if (!im) return;
    const active = live.bays.some((b) => b.state === "lader");
    const speed = 7;
    for (let i = 0; i < count; i++) {
      const u = (((clock.elapsedTime * speed) / length + i / count) % 1 + 1) % 1;
      curve.getPointAt(u, p);
      tmp.position.copy(p);
      tmp.position.y = 0.25;
      tmp.scale.setScalar(active ? 0.22 : 0.0001);
      tmp.updateMatrix();
      im.setMatrixAt(i, tmp.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {points.slice(0, -1).map((a, i) => {
        const b = points[i + 1];
        const len = a.distanceTo(b);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const ang = Math.atan2(b.x - a.x, b.z - a.z);
        return (
          <mesh key={i} position={[mid.x, 0.03, mid.z]} rotation={[-Math.PI / 2, 0, ang]}>
            <planeGeometry args={[0.28, len + 0.28]} />
            <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} />
          </mesh>
        );
      })}
      <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

function Substation({ x, z, upgraded, accent }: { x: number; z: number; upgraded: boolean; accent: string }) {
  return (
    <group position={[x, 0, z]}>
      {/* Eksisterende nettstasjon */}
      <B p={[0, 1.3, 0]} s={[2.6, 2.6, 2.2]} c="#cfd6e6" />
      <B p={[0, 2.7, 0]} s={[2.9, 0.2, 2.5]} c={P.steelDark} />
      <B p={[0, 1.2, 1.11]} s={[1, 1.8, 0.04]} c={P.steel} shadow={false} />
      <B p={[0, 2.2, 1.12]} s={[0.45, 0.4, 0.02]} c="#ffd34d" shadow={false} />
      {upgraded && (
        <group position={[0, 0, -4.2]}>
          {/* Ny trafo med gjerde */}
          <B p={[0, 0.15, 0]} s={[5, 0.3, 4.2]} c="#dfe4ef" />
          <B p={[0, 1.6, 0]} s={[2.6, 2.6, 2]} c={P.transformer} rough={0.5} />
          {[-0.9, -0.3, 0.3, 0.9].map((xx) => (
            <B key={xx} p={[xx, 1.6, 1.05]} s={[0.12, 2.2, 0.12]} c="#e2702a" />
          ))}
          {[-0.7, 0, 0.7].map((xx) => (
            <C key={xx} p={[xx, 3.25, 0]} s={[0.12, 0.7, 0.12]} c="#f4f6fb" />
          ))}
          {/* Gjerde */}
          <B p={[0, 1, 2.1]} s={[5, 2, 0.04]} c={P.steel} shadow={false} />
          <B p={[0, 1, -2.1]} s={[5, 2, 0.04]} c={P.steel} shadow={false} />
          <B p={[2.5, 1, 0]} s={[0.04, 2, 4.2]} c={P.steel} shadow={false} />
          <B p={[-2.5, 1, 0]} s={[0.04, 2, 4.2]} c={P.steel} shadow={false} />
          <B p={[0, 2.05, 2.11]} s={[5, 0.12, 0.08]} c={accent} shadow={false} />
        </group>
      )}
    </group>
  );
}

function Battery({ x, z, count, scale }: { x: number; z: number; count: number; scale: number }) {
  const leds = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (leds.current) leds.current.emissiveIntensity = 0.6 + Math.sin(clock.elapsedTime * 2.4) * 0.4;
  });
  const len = 6 * scale;
  return (
    <group position={[x, 0, z]}>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} position={[0, 0, i * 3.1]}>
          <B p={[0, 0.12, 0]} s={[len + 0.6, 0.24, 2.8]} c="#cfd6e6" />
          <B p={[0, 1.55, 0]} s={[len, 2.6, 2.4]} c={P.battery} rough={0.4} />
          <B p={[0, 2.3, 1.21]} s={[len, 0.35, 0.02]} c={P.charge} shadow={false} />
          {Array.from({ length: Math.max(2, Math.floor(len / 1.4)) }, (_, k) => (
            <B key={k} p={[-len / 2 + 0.7 + k * 1.4, 1.35, 1.215]} s={[0.04, 1.6, 0.02]} c="#c6cede" shadow={false} />
          ))}
          <B p={[len / 4, 3.05, 0]} s={[1.2, 0.4, 1.2]} c="#dfe4ef" />
          <mesh position={[-len / 2 + 0.5, 2.3, 1.23]}>
            <boxGeometry args={[0.3, 0.12, 0.02]} />
            <meshStandardMaterial ref={leds} color={P.charge} emissive={P.charge} emissiveIntensity={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
