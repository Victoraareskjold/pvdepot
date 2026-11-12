"use client";

import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { B, C } from "./parts";
import { P } from "./palette";
import { CHARGER_SIDE, type Layout } from "./layout";
import { live } from "./live";

/**
 * Strømmen til laderne: nettstasjon (ny trafo ved behov), batteri og
 * solceller. Lysende pakker viser hvor strømmen kommer fra mens bilene lader.
 */
function Energy({
  layout,
  accent,
  energy,
  hasSolar,
}: {
  layout: Layout;
  accent: string;
  energy: string;
  hasSolar: boolean;
}) {
  const { transformer: tr, battery: bat, bays, inverter, chargerX } = layout;

  const flows = useMemo(() => {
    if (!bays.length) return [];
    const out: { color: string; pts: THREE.Vector3[] }[] = [];
    const v = (x: number, z: number) => new THREE.Vector3(x, 0.12, z);
    const lastZ = bays[bays.length - 1].z + CHARGER_SIDE;
    // Hovedkabel langs fasaden, så ned langs laderekken.
    const trunk = (z: number, dx: number) => [v(chargerX + dx, z), v(chargerX + dx, lastZ)];
    out.push({ color: accent, pts: [v(tr.x, tr.z), v(tr.x, 2.4), ...trunk(2.4, 1.1)] });
    if (hasSolar) out.push({ color: energy, pts: [v(inverter.x, inverter.z + 0.3), v(inverter.x, 3.0), ...trunk(3.0, 1.45)] });
    if (bat) {
      const b0 = bat.slots[0];
      out.push({ color: P.charge, pts: [v(b0.x + bat.len / 2 + 0.3, b0.z), v(b0.x + bat.len / 2 + 0.3, 3.6), ...trunk(3.6, 1.8)] });
    }
    return out;
  }, [tr.x, tr.z, bat, bays, inverter.x, inverter.z, chargerX, hasSolar, accent, energy]);

  return (
    <group>
      {flows.map((f, i) => (
        <Flow key={i} points={f.pts} color={f.color} />
      ))}
      <Substation x={tr.x} z={tr.z} upgraded={tr.upgraded} accent={accent} />
      {bat && bat.slots.map((sl, i) => <Container key={i} x={sl.x} z={sl.z} len={bat.len} />)}
      <InverterCabinet x={inverter.x} z={inverter.z} />
    </group>
  );
}

export default memo(Energy);

/** Skap for inverter, styringssystem og frekvensmarked, som i skissen. */
function InverterCabinet({ x, z }: { x: number; z: number }) {
  const led = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (led.current) led.current.emissiveIntensity = 0.5 + Math.abs(Math.sin(clock.elapsedTime * 1.7)) * 0.8;
  });
  return (
    <group position={[x, 0, z]}>
      <B p={[0, 0.1, 0]} s={[2.4, 0.2, 1.3]} c="#cfd6e6" />
      <B p={[0, 1.2, 0]} s={[2.2, 2, 1]} c="#ffffff" rough={0.4} />
      <B p={[0, 2.25, 0]} s={[2.3, 0.12, 1.1]} c="#ffb36b" />
      <B p={[-0.55, 1.2, 0.51]} s={[0.02, 1.8, 0.02]} c="#c6cede" shadow={false} />
      <mesh position={[0.45, 1.75, 0.51]}>
        <boxGeometry args={[0.6, 0.3, 0.02]} />
        <meshStandardMaterial ref={led} color="#ffb36b" emissive="#ff9d00" emissiveIntensity={0.8} />
      </mesh>
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

function Container({ x, z, len }: { x: number; z: number; len: number }) {
  const leds = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (leds.current) leds.current.emissiveIntensity = 0.6 + Math.sin(clock.elapsedTime * 2.4 + x) * 0.4;
  });
  return (
    <group position={[x, 0, z]}>
      <B p={[0, 0.12, 0]} s={[len + 0.5, 0.24, 2.8]} c="#cfd6e6" />
      <B p={[0, 1.45, 0]} s={[len, 2.4, 2.4]} c={P.battery} rough={0.4} />
      <B p={[0, 2.15, 1.21]} s={[len, 0.32, 0.02]} c={P.charge} shadow={false} />
      <B p={[0, 2.15, -1.21]} s={[len, 0.32, 0.02]} c={P.charge} shadow={false} />
      <B p={[len / 2 + 0.01, 1.3, 0]} s={[0.02, 1.8, 1.6]} c="#c6cede" shadow={false} />
      <B p={[len / 4, 2.85, 0]} s={[1, 0.35, 1]} c="#dfe4ef" />
      <mesh position={[len / 2 + 0.02, 2.2, 0.6]}>
        <boxGeometry args={[0.02, 0.12, 0.3]} />
        <meshStandardMaterial ref={leds} color={P.charge} emissive={P.charge} emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}
