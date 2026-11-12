"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { B, C } from "./parts";
import { P } from "./palette";
import type { Layout } from "./layout";
import { panelTexture } from "./textures";
import { live } from "./live";

/**
 * Solcellepaneler på taket. Når andelen øker, løfter kranen panelene opp
 * fra pallene og legger dem på plass rad for rad. Når den minker, forsvinner
 * de bakerste.
 */

const FLY = 1.15;
const REMOVE = 0.35;

export default function Solar({ layout, coverage, reduced }: { layout: Layout; coverage: number; reduced: boolean }) {
  const slots = layout.roofSlots;
  const total = slots.length;
  const target = Math.round(total * Math.max(0, Math.min(1, coverage)));
  const { w, h, d } = layout.building;

  const mesh = useRef<THREE.InstancedMesh>(null);
  const boom = useRef<THREE.Group>(null);
  const hook = useRef<THREE.Group>(null);
  const hookLine = useRef<THREE.Mesh>(null);

  const state = useRef({
    launch: new Float32Array(0),
    remove: new Float32Array(0),
    cursor: 0,
    lastLaunch: 0,
    started: false,
    yaw: 0,
  });

  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: panelTexture(), roughness: 0.25, metalness: 0.35 }), []);
  const geometry = useMemo(() => new THREE.BoxGeometry(layout.panelSize.w, 0.07, layout.panelSize.d), [layout.panelSize]);

  // Nytt tak: alle plasser nullstilles.
  useEffect(() => {
    const s = state.current;
    s.launch = new Float32Array(total).fill(-1);
    s.remove = new Float32Array(total).fill(-1);
    s.cursor = 0;
    s.started = false;
    if (mesh.current) {
      mesh.current.count = total;
      const m = new THREE.Matrix4().makeScale(0, 0, 0);
      for (let i = 0; i < total; i++) mesh.current.setMatrixAt(i, m);
      mesh.current.instanceMatrix.needsUpdate = true;
    }
  }, [total, layout]);

  const crane = layout.crane;
  const pivot = useMemo(() => new THREE.Vector3(crane.x, 3.2, crane.z), [crane.x, crane.z]);
  const stack = useMemo(() => new THREE.Vector3(crane.x + 3.2, 1.2, crane.z + 3.5), [crane.x, crane.z]);
  const tmpM = useMemo(() => new THREE.Matrix4(), []);
  const tmpQ = useMemo(() => new THREE.Quaternion(), []);
  const tilt = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18, 0, 0)), []);
  const tmpV = useMemo(() => new THREE.Vector3(), []);
  const tmpS = useMemo(() => new THREE.Vector3(), []);
  const ctrl = useMemo(() => new THREE.Vector3(), []);
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(), []);

  useFrame(({ clock }, rawDt) => {
    const im = mesh.current;
    if (!im) return;
    const s = state.current;
    const now = clock.elapsedTime;
    const dt = Math.min(rawDt, 0.05);
    if (s.launch.length !== total) return;

    // Vent litt ved oppstart, så monteringen synes.
    if (!s.started) {
      if (now < 1.2) return;
      s.started = true;
      if (reduced) {
        for (let i = 0; i < target; i++) s.launch[i] = now - FLY;
        s.cursor = target;
      }
    }

    const rate = Math.max(14, total / 7);
    // Legg på nye paneler
    if (s.cursor < target && now - s.lastLaunch >= 1 / rate) {
      const n = Math.max(1, Math.floor((now - s.lastLaunch) * rate));
      for (let k = 0; k < n && s.cursor < target; k++) {
        s.remove[s.cursor] = -1;
        s.launch[s.cursor] = now;
        s.cursor++;
      }
      s.lastLaunch = now;
    }
    // Ta bort overskytende
    while (s.cursor > target) {
      s.cursor--;
      s.remove[s.cursor] = now;
    }

    let inFlight = 0;
    let latest = -1;
    for (let i = 0; i < total; i++) {
      const L = s.launch[i];
      const R = s.remove[i];
      if (L < 0) continue;
      let scale = 1;
      const slot = slots[i];
      if (R >= 0) {
        const k = (now - R) / REMOVE;
        if (k >= 1) {
          s.launch[i] = -1;
          s.remove[i] = -1;
          tmpM.makeScale(0, 0, 0);
          im.setMatrixAt(i, tmpM);
          continue;
        }
        scale = 1 - k;
        tmpV.copy(slot);
        tmpV.y += k * 1.5;
        tmpQ.copy(tilt);
      } else {
        const k = (now - L) / FLY;
        if (k < 1) {
          inFlight++;
          latest = i;
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          ctrl.set((stack.x + slot.x) / 2, h + 9, (stack.z + slot.z) / 2);
          curve.v0.copy(stack);
          curve.v1.copy(ctrl);
          curve.v2.copy(slot);
          curve.getPoint(e, tmpV);
          // Panelet svinger litt mens det heises
          tmpQ.setFromEuler(new THREE.Euler(-0.18 * e, (1 - e) * 0.8, Math.sin(k * 9) * 0.12 * (1 - e)));
        } else {
          tmpV.copy(slot);
          tmpQ.copy(tilt);
        }
      }
      tmpS.setScalar(scale);
      tmpM.compose(tmpV, tmpQ, tmpS);
      im.setMatrixAt(i, tmpM);
    }
    im.instanceMatrix.needsUpdate = true;

    // Kranen peker mot panelet som heises
    let wantYaw = -0.6;
    if (latest >= 0) {
      const t = slots[latest];
      wantYaw = Math.atan2(-(t.z - pivot.z), t.x - pivot.x);
    }
    s.yaw += (wantYaw - s.yaw) * Math.min(1, dt * 3);
    if (boom.current) boom.current.rotation.y = s.yaw;
    if (hook.current && hookLine.current) {
      const drop = inFlight > 0 ? 3 + Math.sin(now * 3) * 0.5 : 5;
      hook.current.position.y = -drop;
      hookLine.current.scale.y = drop;
      hookLine.current.position.y = -drop / 2;
    }

    live.solarInstalled = target > 0 ? Math.min(s.cursor, target) / target : 0;
    live.installing = inFlight > 0;
  });

  return (
    <group>
      <instancedMesh ref={mesh} args={[geometry, material, Math.max(1, total)]} castShadow receiveShadow frustumCulled={false} />

      {/* Vekselretter på fasaden, kabel ned i grunnen */}
      <B p={[-w / 2 + 16.5, 3, 0.25]} s={[1.4, 1.8, 0.4]} c="#ffffff" />
      <B p={[-w / 2 + 16.5, 3.4, 0.46]} s={[0.9, 0.3, 0.02]} c={P.charge} shadow={false} />

      {/* Kranbil */}
      <group position={[crane.x, 0, crane.z]}>
        <B p={[0, 1.1, 0]} s={[3, 1.4, 7]} c={P.crane} rough={0.5} />
        <B p={[0, 2.3, 2.6]} s={[2.6, 1.4, 1.8]} c={P.crane} rough={0.5} />
        <B p={[0, 2.5, 3.52]} s={[2.2, 0.8, 0.04]} c={P.glassDark} shadow={false} />
        {[-2.4, 0, 2.4].map((z) =>
          [-1.35, 1.35].map((x) => (
            <C key={`${x}${z}`} p={[x, 0.5, z]} s={[0.5, 0.4, 0.5]} r={[0, 0, Math.PI / 2]} c={P.tire} />
          )),
        )}
        {/* Støtteben */}
        {[-2.8, 2.8].map((z) =>
          [-2.2, 2.2].map((x) => <B key={`${x}${z}`} p={[x, 0.35, z]} s={[0.4, 0.7, 0.4]} c="#2c3346" />),
        )}
        <C p={[0, 2.1, -1.5]} s={[0.9, 0.6, 0.9]} c="#2c3346" />
      </group>
      <group ref={boom} position={[pivot.x, pivot.y, pivot.z - 1.5]}>
        <group rotation={[0, 0, 0.62]}>
          <B p={[7.5, 0, 0]} s={[15, 0.55, 0.55]} c={P.crane} rough={0.5} />
          <B p={[3, 0, 0]} s={[6, 0.75, 0.75]} c={P.crane} rough={0.5} />
          <group position={[15, 0, 0]} rotation={[0, 0, -0.62]}>
            <mesh ref={hookLine} position={[0, -2.5, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 1, 6]} />
              <meshStandardMaterial color="#2c3346" />
            </mesh>
            <group ref={hook}>
              <B p={[0, 0, 0]} s={[0.4, 0.4, 0.4]} c="#2c3346" />
            </group>
          </group>
        </group>
      </group>

      {/* Paller med paneler ved kranen */}
      {[0, 1].map((i) => (
        <group key={i} position={[stack.x + i * 2.2, 0, stack.z]}>
          <B p={[0, 0.1, 0]} s={[1.4, 0.2, 2]} c={P.pallet} />
          <B p={[0, 0.55, 0]} s={[1.2, 0.7, 1.85]} c="#1b3a78" rough={0.3} />
        </group>
      ))}
      {/* Sperrebånd */}
      <B p={[crane.x, 0.5, crane.z + 6]} s={[8, 0.08, 0.08]} c={P.cone} shadow={false} />
      <B p={[crane.x - 4, 0.25, crane.z + 6]} s={[0.1, 0.5, 0.1]} c={P.cone} />
      <B p={[crane.x + 4, 0.25, crane.z + 6]} s={[0.1, 0.5, 0.1]} c={P.cone} />
      {void d}
    </group>
  );
}
