"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/**
 * Depotet: lagerbygg med solceller på taket, ladere i gården og lastebiler
 * som kjører inn når antallet økes. Kameraet står fast (ingen styring).
 *
 * Målestokken er stilisert: bygget vokser med takflaten, men mindre enn i
 * virkeligheten, så lastebilene synes.
 */

export interface SceneProps {
  vehicles: number;
  vehicleModel: "rigid" | "semi" | "bus";
  chargerKw: number;
  roofM2: number;
  solarCoverage: number;
  batteryKwh: number;
  gridUpgrade: boolean;
  accent: string;
  energy: string;
}

const MAX_VISIBLE_TRUCKS = 24;
const PER_ROW = 12;
const TRUCK_SPACING = 3.8;

const COLORS = {
  ground: "#dfe6ef",
  yard: "#c8d1dd",
  line: "#f4f7fb",
  wall: "#d5deea",
  wallRib: "#bfcbdb",
  roof: "#b4c1d2",
  parapet: "#9fb0c5",
  panel: "#1d2f4d",
  panelFrame: "#e8eef6",
  truckBox: "#f7f9fc",
  tire: "#2a3342",
  glass: "#7fa4c9",
  charger: "#f7f9fc",
  charge: "#19b37a",
  battery: "#f2f5f9",
  transformer: "#e8833a",
  tree: "#8cc69a",
  trunk: "#a98b6c",
};

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Byggets mål ut fra takflaten (stilisert). */
function buildingSize(roofM2: number) {
  const w = THREE.MathUtils.clamp(16 + Math.sqrt(roofM2) * 0.28, 16, 40);
  const d = THREE.MathUtils.clamp(w * 0.52, 9, 20);
  return { w, d, h: 5.5 };
}

function truckLength(model: SceneProps["vehicleModel"]) {
  return model === "semi" ? 10.5 : model === "bus" ? 9 : 7.5;
}

/* ------------------------------------------------------------------ */

export default function DepotScene(props: SceneProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  // Stopp tegningen når scenen er utenfor skjermen.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0 }}>
      <Canvas
        orthographic
        shadows
        dpr={[1, 1.75]}
        frameloop={visible ? "always" : "never"}
        camera={{ position: [40, 34, 40], zoom: 14, near: 0.1, far: 500 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
        aria-label="Illustrasjon av depotet med lastebiler, ladere og solceller"
        role="img"
      >
        <SceneContent {...props} />
      </Canvas>
    </div>
  );
}

function SceneContent(props: SceneProps) {
  const { w, d } = buildingSize(props.roofM2);
  const visibleTrucks = Math.min(props.vehicles, MAX_VISIBLE_TRUCKS);
  const rows = Math.max(1, Math.ceil(visibleTrucks / PER_ROW));
  const perRow = Math.min(visibleTrucks, PER_ROW);
  const len = truckLength(props.vehicleModel);

  // Utstrekning brukes til kamerazoom og gårdsplass.
  const rowWidth = Math.max(perRow, 1) * TRUCK_SPACING;
  const extentX = Math.max(w, rowWidth) + 12;
  const yardDepth = 6 + rows * (len + 5);
  const extentZ = d + yardDepth + 4;

  return (
    <>
      <color attach="background" args={[COLORS.ground]} />
      <hemisphereLight args={["#ffffff", "#c9d4e3", 1.6]} />
      <directionalLight
        position={[28, 40, 18]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-bias={-0.0005}
      />
      <CameraRig extentX={extentX} extentZ={extentZ} centerZ={(yardDepth - d) / 2} />

      <Ground extentX={extentX} yardDepth={yardDepth} />
      <Building roofM2={props.roofM2} coverage={props.solarCoverage} accent={props.accent} />
      <Fleet
        count={visibleTrucks}
        model={props.vehicleModel}
        chargerKw={props.chargerKw}
        accent={props.accent}
      />
      <Battery kwh={props.batteryKwh} x={-w / 2 - 4.5} z={-d / 2} />
      <Transformer show={props.gridUpgrade} x={w / 2 + 4} z={-2} />
      <EnergyFlow
        solar={props.solarCoverage > 0 && props.roofM2 > 0 && visibleTrucks > 0}
        battery={props.batteryKwh > 0 && visibleTrucks > 0}
        buildingW={w}
        batteryX={-w / 2 - 4.5}
        batteryZ={-d / 2}
        rowWidth={rowWidth}
        color={props.energy}
      />
      <Trees extentX={extentX} d={d} yardDepth={yardDepth} />
    </>
  );
}

/* ---------------- Kamera ---------------- */

function CameraRig({ extentX, extentZ, centerZ }: { extentX: number; extentZ: number; centerZ: number }) {
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3());
  const snap = reduceMotion();

  useFrame((_, dt) => {
    const cam = camera as THREE.OrthographicCamera;
    // Isometrisk projeksjon: synlig bredde ≈ (x+z)·cos45, høyde ≈ (x+z)·0,5
    const needW = (extentX + extentZ) * 0.72;
    const needH = (extentX + extentZ) * 0.46;
    const zoom = Math.min(size.width / needW, size.height / needH);
    const k = snap ? 1 : 1 - Math.exp(-4 * dt);
    cam.zoom += (zoom - cam.zoom) * k;
    // Litt over bakken, så scenen havner under tallene øverst.
    target.current.set(0, 3, centerZ);
    cam.position.set(40 + target.current.x, 34 + target.current.y, 40 + target.current.z);
    cam.lookAt(target.current);
    cam.updateProjectionMatrix();
  });
  return null;
}

/* ---------------- Bakke ---------------- */

function Ground({ extentX, yardDepth }: { extentX: number; yardDepth: number }) {
  const lines = useMemo(() => {
    const out: number[] = [];
    for (let x = -extentX / 2 + 2; x < extentX / 2 - 1; x += TRUCK_SPACING) out.push(x);
    return out;
  }, [extentX]);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color={COLORS.ground} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, yardDepth / 2 - 1]} receiveShadow>
        <planeGeometry args={[extentX, yardDepth + 2]} />
        <meshStandardMaterial color={COLORS.yard} />
      </mesh>
      {lines.map((x) => (
        <mesh key={x} rotation-x={-Math.PI / 2} position={[x - TRUCK_SPACING / 2 + 1.9, 0.01, 9]}>
          <planeGeometry args={[0.12, 7]} />
          <meshBasicMaterial color={COLORS.line} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------- Bygg og solceller ---------------- */

function Building({ roofM2, coverage, accent }: { roofM2: number; coverage: number; accent: string }) {
  const target = buildingSize(roofM2);
  const group = useRef<THREE.Group>(null);
  const size = useRef({ ...target });
  const [, force] = useState(0);
  const snap = reduceMotion();

  // Bygget vokser mykt mot ny størrelse.
  useFrame((_, dt) => {
    const k = snap ? 1 : 1 - Math.exp(-5 * dt);
    const s = size.current;
    const dw = target.w - s.w;
    const dd = target.d - s.d;
    if (Math.abs(dw) + Math.abs(dd) < 0.01) return;
    s.w += dw * k;
    s.d += dd * k;
    force((n) => (n + 1) % 1_000_000);
  });

  const { w, d, h } = size.current;
  const docks = Math.max(3, Math.round(w / 6));

  return (
    <group ref={group} position={[0, 0, -d / 2]}>
      {/* Vegger */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={COLORS.wall} />
      </mesh>
      {/* Ribber på frontveggen */}
      {Array.from({ length: Math.floor(w / 1.4) }, (_, i) => (
        <mesh key={i} position={[-w / 2 + 0.7 + i * 1.4, h / 2, d / 2 + 0.03]}>
          <boxGeometry args={[0.12, h - 0.4, 0.06]} />
          <meshStandardMaterial color={COLORS.wallRib} />
        </mesh>
      ))}
      {/* Porter */}
      {Array.from({ length: docks }, (_, i) => {
        const x = -w / 2 + (w / docks) * (i + 0.5);
        return (
          <group key={i} position={[x, 0, d / 2 + 0.08]}>
            <mesh position={[0, 1.7, 0]}>
              <boxGeometry args={[2.6, 3.4, 0.1]} />
              <meshStandardMaterial color={accent} />
            </mesh>
            <mesh position={[0, 0.5, 0.6]} castShadow>
              <boxGeometry args={[3, 1, 1.2]} />
              <meshStandardMaterial color={COLORS.wallRib} />
            </mesh>
          </group>
        );
      })}
      {/* Tak */}
      <mesh position={[0, h + 0.05, 0]} receiveShadow>
        <boxGeometry args={[w, 0.1, d]} />
        <meshStandardMaterial color={COLORS.roof} />
      </mesh>
      {/* Takkant */}
      {[
        [0, d / 2, w, 0.2],
        [0, -d / 2, w, 0.2],
        [w / 2, 0, 0.2, d],
        [-w / 2, 0, 0.2, d],
      ].map(([x, z, sx, sz], i) => (
        <mesh key={i} position={[x, h + 0.3, z]} castShadow>
          <boxGeometry args={[sx, 0.5, sz]} />
          <meshStandardMaterial color={COLORS.parapet} />
        </mesh>
      ))}
      {/* Logo-stripe */}
      <mesh position={[-w / 2 + 3.2, h - 1.1, d / 2 + 0.07]}>
        <boxGeometry args={[4.4, 1.1, 0.05]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      <SolarArray w={w} d={d} h={h} coverage={coverage} />
    </group>
  );
}

const PANEL_W = 1.1;
const PANEL_D = 0.62;
const PANEL_GAP_X = 0.12;
const PANEL_GAP_Z = 0.5;

function SolarArray({ w, d, h, coverage }: { w: number; d: number; h: number; coverage: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const cols = Math.max(0, Math.floor((w - 1.6) / (PANEL_W + PANEL_GAP_X)));
  const rows = Math.max(0, Math.floor((d - 1.6) / (PANEL_D + PANEL_GAP_Z)));
  const max = cols * rows;
  const capacity = 1200;
  const target = Math.min(capacity, Math.round(max * THREE.MathUtils.clamp(coverage, 0, 1)));

  // Skala per panel. Paneler legges rad for rad bakfra.
  const scales = useRef(new Float32Array(capacity));
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const snap = reduceMotion();

  useLayoutEffect(() => {
    if (mesh.current) mesh.current.count = Math.min(capacity, max);
  }, [max]);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    let changed = false;
    const offX = -((cols - 1) * (PANEL_W + PANEL_GAP_X)) / 2;
    const offZ = -((rows - 1) * (PANEL_D + PANEL_GAP_Z)) / 2;
    for (let i = 0; i < Math.min(capacity, max); i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const goal = i < target ? 1 : 0;
      const cur = scales.current[i];
      // Litt forsinkelse per panel gir en «bølge» når mange legges til samtidig.
      const delay = Math.abs(i - target) * 0.0006;
      const k = snap ? 1 : 1 - Math.exp(-(9 - Math.min(delay * 60, 6)) * dt);
      const next = Math.abs(goal - cur) < 0.002 ? goal : cur + (goal - cur) * k;
      if (next !== cur) changed = true;
      scales.current[i] = next;
      dummy.position.set(offX + col * (PANEL_W + PANEL_GAP_X), h + 0.35 + (1 - next) * 2.5, offZ + row * (PANEL_D + PANEL_GAP_Z));
      dummy.rotation.set(-0.17, 0, 0);
      dummy.scale.setScalar(Math.max(0.0001, next));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    if (changed) m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, capacity]} castShadow frustumCulled={false}>
      <boxGeometry args={[PANEL_W, 0.06, PANEL_D]} />
      <meshStandardMaterial color={COLORS.panel} metalness={0.3} roughness={0.35} />
    </instancedMesh>
  );
}

/* ---------------- Lastebiler og ladere ---------------- */

function slotPosition(i: number, count: number, len: number): [number, number] {
  const row = Math.floor(i / PER_ROW);
  const inRow = Math.min(PER_ROW, count - row * PER_ROW);
  const idx = i % PER_ROW;
  const x = (idx - (inRow - 1) / 2) * TRUCK_SPACING;
  const z = 6.5 + row * (len + 5);
  return [x, z];
}

function Fleet({
  count,
  model,
  chargerKw,
  accent,
}: {
  count: number;
  model: SceneProps["vehicleModel"];
  chargerKw: number;
  accent: string;
}) {
  const len = truckLength(model);
  // Biler som tas bort, beholdes til de har kjørt ut av bildet.
  const [slotCount, setSlotCount] = useState(count);
  const countRef = useRef(count);
  const gone = useRef(new Set<number>());
  useEffect(() => {
    countRef.current = count;
    for (const i of gone.current) if (i < count) gone.current.delete(i);
    setSlotCount((n) => Math.max(n, count));
  }, [count]);
  const handleGone = (i: number) => {
    gone.current.add(i);
    setSlotCount((n) => {
      let next = n;
      while (next > countRef.current && gone.current.has(next - 1)) {
        gone.current.delete(next - 1);
        next--;
      }
      return next;
    });
  };
  const slots = Array.from({ length: slotCount }, (_, i) => i);

  return (
    <group>
      {slots.map((i) => {
        const active = i < count;
        const [x, z] = slotPosition(i, Math.max(count, i + 1), len);
        return (
          <Bay
            key={i}
            index={i}
            x={x}
            z={z}
            len={len}
            model={model}
            active={active}
            chargerKw={chargerKw}
            accent={accent}
            onGone={() => handleGone(i)}
          />
        );
      })}
    </group>
  );
}

function Bay({
  index,
  x,
  z,
  len,
  model,
  active,
  chargerKw,
  accent,
  onGone,
}: {
  index: number;
  x: number;
  z: number;
  len: number;
  model: SceneProps["vehicleModel"];
  active: boolean;
  chargerKw: number;
  accent: string;
  onGone: () => void;
}) {
  const truck = useRef<THREE.Group>(null);
  const charger = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  // Biler kjører inn fra gaten (stor z) og rygger mot laderen.
  const progress = useRef(active ? 0 : 1);
  const snap = reduceMotion();
  const pos = useRef(new THREE.Vector2(x, z));
  const gone = useRef(false);

  useEffect(() => {
    if (active) gone.current = false;
  }, [active]);

  useFrame((state, dt) => {
    const goal = active ? 1 : 0;
    const speed = snap ? 100 : 1.4;
    const p = progress.current;
    progress.current = THREE.MathUtils.clamp(p + Math.sign(goal - p) * dt * speed, 0, 1);
    const k = snap ? 1 : 1 - Math.exp(-6 * dt);
    pos.current.x += (x - pos.current.x) * k;
    pos.current.y += (z - pos.current.y) * k;

    const t = easeOutCubic(progress.current);
    if (truck.current) {
      truck.current.position.set(pos.current.x, 0, pos.current.y + len / 2 + 0.9 + (1 - t) * 40);
      truck.current.visible = progress.current > 0.001;
    }
    if (charger.current) {
      const s = THREE.MathUtils.clamp(progress.current * 1.6, 0, 1);
      charger.current.scale.setScalar(Math.max(0.0001, s));
      charger.current.position.set(pos.current.x + 1.25, 0, pos.current.y - 0.4);
    }
    if (ring.current) {
      // Pulserende ladering når bilen står parkert.
      const parked = progress.current >= 1 ? 1 : 0;
      const pulse = (Math.sin(state.clock.elapsedTime * 3 + index * 0.7) + 1) / 2;
      const mat = ring.current.material as THREE.MeshBasicMaterial;
      mat.opacity = parked * (0.25 + pulse * 0.45);
      ring.current.position.set(pos.current.x, 0.02, pos.current.y + len / 2 + 0.9);
      ring.current.scale.set(1, (len + 1.2) / 2, 1);
    }
    if (!active && progress.current <= 0 && !gone.current) {
      gone.current = true;
      onGone();
    }
  });

  const chargerHeight = 1.5 + Math.min(1, chargerKw / 360) * 1.0;

  return (
    <>
      <mesh ref={ring} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.55, 1.75, 40]} />
        <meshBasicMaterial color={COLORS.charge} transparent opacity={0} depthWrite={false} />
      </mesh>
      <group ref={charger}>
        <mesh position={[0, chargerHeight / 2, 0]} castShadow>
          <boxGeometry args={[0.7, chargerHeight, 0.45]} />
          <meshStandardMaterial color={COLORS.charger} />
        </mesh>
        <mesh position={[0, chargerHeight + 0.06, 0]}>
          <boxGeometry args={[0.74, 0.12, 0.49]} />
          <meshStandardMaterial color={accent} />
        </mesh>
        <mesh position={[0, chargerHeight * 0.68, 0.23]}>
          <planeGeometry args={[0.42, 0.3]} />
          <meshBasicMaterial color={COLORS.charge} />
        </mesh>
      </group>
      <group ref={truck} visible={false}>
        <Truck model={model} len={len} accent={accent} />
      </group>
    </>
  );
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/** Bil med front mot laderen (negativ z). */
function Truck({ model, len, accent }: { model: SceneProps["vehicleModel"]; len: number; accent: string }) {
  const wheels = (zs: number[]) =>
    zs.flatMap((z) =>
      [-1.05, 1.05].map((x) => (
        <mesh key={`${x}-${z}`} position={[x, 0.5, z]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.5, 0.5, 0.4, 14]} />
          <meshStandardMaterial color={COLORS.tire} />
        </mesh>
      )),
    );

  if (model === "bus") {
    return (
      <group>
        <mesh position={[0, 1.75, 0]} castShadow>
          <boxGeometry args={[2.5, 2.9, len]} />
          <meshStandardMaterial color={accent} />
        </mesh>
        <mesh position={[0, 2.2, 0]}>
          <boxGeometry args={[2.54, 0.9, len - 0.8]} />
          <meshStandardMaterial color={COLORS.glass} />
        </mesh>
        {wheels([-len / 2 + 1.6, len / 2 - 1.8])}
      </group>
    );
  }

  const cabLen = 2.2;
  const cargoLen = len - cabLen - 0.3;
  return (
    <group>
      {/* Førerhus */}
      <group position={[0, 0, -len / 2 + cabLen / 2]}>
        <mesh position={[0, 1.75, 0]} castShadow>
          <boxGeometry args={[2.4, 2.5, cabLen]} />
          <meshStandardMaterial color={accent} />
        </mesh>
        <mesh position={[0, 2.25, -cabLen / 2 - 0.01]}>
          <planeGeometry args={[2.1, 0.9]} />
          <meshStandardMaterial color={COLORS.glass} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* Last eller trailer */}
      <mesh position={[0, model === "semi" ? 2.15 : 2.0, len / 2 - cargoLen / 2]} castShadow>
        <boxGeometry args={[2.5, model === "semi" ? 3.0 : 2.8, cargoLen]} />
        <meshStandardMaterial color={COLORS.truckBox} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[1.6, 0.3, len - 0.4]} />
        <meshStandardMaterial color={COLORS.tire} />
      </mesh>
      {wheels(model === "semi" ? [-len / 2 + 1.2, -len / 2 + 2.6, len / 2 - 2.2, len / 2 - 0.9] : [-len / 2 + 1.2, len / 2 - 1.4])}
    </group>
  );
}

/* ---------------- Batteri og nett ---------------- */

function useGrow(goal: number) {
  const v = useRef(goal);
  const snap = reduceMotion();
  return (dt: number) => {
    const k = snap ? 1 : 1 - Math.exp(-5 * dt);
    v.current += (goal - v.current) * k;
    if (Math.abs(goal - v.current) < 0.001) v.current = goal;
    return v.current;
  };
}

function Battery({ kwh, x, z }: { kwh: number; x: number; z: number }) {
  const group = useRef<THREE.Group>(null);
  // Én container per påbegynte 1 000 kWh, lengden følger størrelsen.
  const length = kwh > 0 ? THREE.MathUtils.clamp(3 + kwh / 120, 3.5, 12) : 0;
  const grow = useGrow(kwh > 0 ? 1 : 0);
  const len = useRef(length || 3.5);

  useFrame((_, dt) => {
    const s = grow(dt);
    len.current += ((length || len.current) - len.current) * Math.min(1, dt * 5);
    if (group.current) {
      group.current.visible = s > 0.01;
      group.current.scale.set(1, Math.max(0.0001, s), len.current / 6);
      group.current.position.set(x, 0, z);
    }
  });

  return (
    <group ref={group} visible={false}>
      <mesh position={[0, 1.3, 0]} castShadow>
        <boxGeometry args={[2.6, 2.6, 6]} />
        <meshStandardMaterial color={COLORS.battery} />
      </mesh>
      <mesh position={[1.31, 1.3, 0]}>
        <boxGeometry args={[0.02, 0.35, 5.4]} />
        <meshBasicMaterial color={COLORS.charge} />
      </mesh>
      <mesh position={[0, 2.62, 0]}>
        <boxGeometry args={[2.2, 0.08, 5.6]} />
        <meshStandardMaterial color={COLORS.wallRib} />
      </mesh>
    </group>
  );
}

function Transformer({ show, x, z }: { show: boolean; x: number; z: number }) {
  const group = useRef<THREE.Group>(null);
  const grow = useGrow(show ? 1 : 0);
  useFrame((_, dt) => {
    const s = grow(dt);
    if (group.current) {
      group.current.visible = s > 0.01;
      group.current.scale.setScalar(Math.max(0.0001, s));
      group.current.position.set(x, 0, z);
    }
  });
  return (
    <group ref={group} visible={false}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[2.4, 2.2, 2]} />
        <meshStandardMaterial color={COLORS.battery} />
      </mesh>
      <mesh position={[0, 2.25, 0]}>
        <boxGeometry args={[2.5, 0.1, 2.1]} />
        <meshStandardMaterial color={COLORS.transformer} />
      </mesh>
      <mesh position={[0, 1.5, 1.01]}>
        <planeGeometry args={[0.7, 0.7]} />
        <meshBasicMaterial color={COLORS.transformer} />
      </mesh>
    </group>
  );
}

/* ---------------- Energiflyt ---------------- */

function EnergyFlow({
  solar,
  battery,
  buildingW,
  batteryX,
  batteryZ,
  rowWidth,
  color,
}: {
  solar: boolean;
  battery: boolean;
  buildingW: number;
  batteryX: number;
  batteryZ: number;
  rowWidth: number;
  color: string;
}) {
  // Punkter som går fra taket ned langs veggen og ut til laderekka.
  const paths = useMemo(() => {
    const out: { curve: THREE.CatmullRomCurve3; on: "solar" | "battery" }[] = [];
    const roofEdge = Math.min(buildingW / 2 - 2, rowWidth / 2);
    out.push({
      on: "solar",
      curve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(-roofEdge / 2, 6, -4),
        new THREE.Vector3(-roofEdge / 2, 5.9, 0.2),
        new THREE.Vector3(-roofEdge / 2, 0.3, 1.2),
        new THREE.Vector3(0, 0.15, 5.6),
        new THREE.Vector3(rowWidth / 2 - 1, 0.15, 5.9),
      ]),
    });
    out.push({
      on: "solar",
      curve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(roofEdge / 2, 6, -4),
        new THREE.Vector3(roofEdge / 2, 5.9, 0.2),
        new THREE.Vector3(roofEdge / 2, 0.3, 1.2),
        new THREE.Vector3(0, 0.15, 5.6),
        new THREE.Vector3(-rowWidth / 2 + 1, 0.15, 5.9),
      ]),
    });
    out.push({
      on: "battery",
      curve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(batteryX, 1.2, batteryZ),
        new THREE.Vector3(batteryX, 0.15, 3),
        new THREE.Vector3(-rowWidth / 2, 0.15, 5.6),
        new THREE.Vector3(rowWidth / 2 - 1, 0.15, 5.9),
      ]),
    });
    return out;
  }, [buildingW, batteryX, batteryZ, rowWidth]);

  const DOTS = 7;
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const fade = useRef([0, 0, 0]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const still = reduceMotion();

  useFrame((state, dt) => {
    paths.forEach((p, pi) => {
      const on = p.on === "solar" ? solar : battery;
      fade.current[pi] += ((on ? 1 : 0) - fade.current[pi]) * Math.min(1, dt * 3);
      for (let i = 0; i < DOTS; i++) {
        const m = refs.current[pi * DOTS + i];
        if (!m) continue;
        const t = still ? i / DOTS : (state.clock.elapsedTime * 0.12 + i / DOTS + pi * 0.13) % 1;
        p.curve.getPointAt(t, tmp);
        m.position.copy(tmp);
        const s = fade.current[pi] * (0.18 + Math.sin(t * Math.PI) * 0.12);
        m.scale.setScalar(Math.max(0.0001, s));
        m.visible = fade.current[pi] > 0.02;
      }
    });
  });

  return (
    <group>
      {paths.flatMap((_, pi) =>
        Array.from({ length: DOTS }, (_, i) => (
          <mesh key={`${pi}-${i}`} ref={(el) => void (refs.current[pi * DOTS + i] = el)}>
            <sphereGeometry args={[1, 10, 10]} />
            <meshBasicMaterial color={color} />
          </mesh>
        )),
      )}
    </group>
  );
}

/* ---------------- Trær ---------------- */

function Trees({ extentX, d, yardDepth }: { extentX: number; d: number; yardDepth: number }) {
  const spots: [number, number, number][] = [
    [-extentX / 2 - 3, -d - 1, 1.1],
    [-extentX / 2 - 5, -d / 2, 0.9],
    [extentX / 2 + 3, -d - 2, 1],
    [extentX / 2 + 4, yardDepth - 2, 1.2],
    [-extentX / 2 - 3, yardDepth - 1, 1],
    [extentX / 2 + 6, -d / 2 + 2, 0.8],
  ];
  return (
    <group>
      {spots.map(([x, z, s], i) => (
        <group key={i} position={[x, 0, z]} scale={s}>
          <mesh position={[0, 0.8, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.22, 1.6, 8]} />
            <meshStandardMaterial color={COLORS.trunk} />
          </mesh>
          <mesh position={[0, 2.4, 0]} castShadow>
            <sphereGeometry args={[1.3, 14, 12]} />
            <meshStandardMaterial color={COLORS.tree} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
