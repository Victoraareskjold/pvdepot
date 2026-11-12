"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { computeLayout, TURN_R, type Layout, type WorldParams } from "./layout";
import Building from "./Building";
import Ground, { DockYard } from "./Ground";
import Fleet from "./Fleet";
import Solar from "./Solar";
import Energy from "./Energy";
import { P } from "./palette";
import { pinDefs, PinTracker, type PinDef, type PinLabels } from "./Pins";

export type Shot = "hero" | "fleet" | "roof" | "energy" | "check" | "results" | "lead";

export interface WorldProps extends WorldParams {
  shot: Shot;
  accent: string;
  energy: string;
  sign: string;
  labels: PinLabels;
  /** Plass dekket av paneler i px: scenen sentreres i resten av skjermen */
  inset: { left: number; top: number; bottom: number };
}

export default function World(props: WorldProps) {
  const [small, setSmall] = useState(false);
  const [reduced, setReduced] = useState(false);
  // Full skarphet: bruk skjermens pikseltetthet (maks 2). Ytelsesvakten
  // går bare ned ett hakk, aldri under 1,5 på Retina.
  const [dprRange, setDprRange] = useState({ high: 2, low: 1.5 });
  const [dpr, setDpr] = useState(2);
  useEffect(() => {
    setSmall(window.innerWidth < 760);
    const high = Math.min(window.devicePixelRatio || 1, 2);
    const low = high >= 2 ? 1.5 : Math.max(1, high * 0.8);
    setDprRange({ high, low });
    setDpr(high);
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const { bays, vehicleModel, roofM2, batteryKwh, gridUpgrade, chargerKw } = props;
  const layout = useMemo(
    () => computeLayout({ bays, vehicleModel, roofM2, solarCoverage: 0, batteryKwh, gridUpgrade, chargerKw }),
    [bays, vehicleModel, roofM2, batteryKwh, gridUpgrade, chargerKw],
  );
  const pins = useMemo(() => pinDefs(layout, props.labels), [layout, props.labels]);
  const pinRefs = useRef(new Map<string, HTMLDivElement>());

  return (
    <>
    <Canvas
      orthographic
      shadows={{ type: THREE.PCFSoftShadowMap }}
      dpr={dpr}
      camera={{ position: [80, 70, 80], zoom: 10, near: -500, far: 1000 }}
      gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, powerPreference: "high-performance" }}
      aria-hidden
      onCreated={({ gl }) => {
        // ?debug=1 i URL-en gir tilgang til tegnestatistikk i konsollen (window.__gl.info).
        if (window.location.search.includes("debug")) (window as unknown as { __gl: unknown }).__gl = gl;
      }}
    >
      <color attach="background" args={[P.ground]} />
      {/* Senk oppløsningen hvis maskinen ikke henger med, øk igjen når den gjør det */}
      <PerformanceMonitor
        onDecline={() => setDpr(dprRange.low)}
        onIncline={() => setDpr(dprRange.high)}
        flipflops={3}
        onFallback={() => setDpr(dprRange.low)}
      />
      <Scene {...props} layout={layout} small={small} reduced={reduced} />
      <PinTracker pins={pins} refs={pinRefs} />
    </Canvas>
    <div className="pins" aria-hidden>
      {pins.map((p) => (
        <PinEl key={p.id} pin={p} refs={pinRefs} />
      ))}
    </div>
    </>
  );
}

function PinEl({ pin, refs }: { pin: PinDef; refs: React.RefObject<Map<string, HTMLDivElement>> }) {
  return (
    <div
      className={`pin pin-${pin.tone}`}
      ref={(el) => {
        if (el) refs.current.set(pin.id, el);
        else refs.current.delete(pin.id);
      }}
    >
      <span className="pin-title">{pin.title}</span>
      <span className="pin-value">{pin.value}</span>
      <span className="pin-stem" />
    </div>
  );
}

function Scene(props: WorldProps & { layout: Layout; small: boolean; reduced: boolean }) {
  const { layout, vehicleModel, solarCoverage } = props;

  return (
    <>
      <hemisphereLight args={["#ffffff", "#b9c3dc", 1.55]} />
      <Sun layout={layout} small={props.small} />
      <CameraRig layout={layout} shot={props.shot} inset={props.inset} reduced={props.reduced} />

      <Ground layout={layout} rich={!props.small} />
      <Building layout={layout} accent={props.accent} sign={props.sign} />
      <DockYard layout={layout} />
      <Solar layout={layout} coverage={solarCoverage} reduced={props.reduced} />
      <Energy layout={layout} accent={props.accent} energy={props.energy} hasSolar={solarCoverage > 0} />
      <Fleet layout={layout} model={vehicleModel} accent={props.accent} energy={props.energy} reduced={props.reduced} />
    </>
  );
}

function Sun({ layout, small }: { layout: Layout; small: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const { bounds } = layout;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const half = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 + 12;

  useEffect(() => {
    const l = light.current;
    if (!l) return;
    l.target.position.set(cx, 0, cz);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.updateProjectionMatrix();
  }, [cx, cz, half]);

  return (
    <directionalLight
      ref={light}
      color="#fff3df"
      intensity={2.7}
      position={[cx + 45, 70, cz + 30]}
      castShadow
      shadow-mapSize={small ? [1024, 1024] : [2048, 2048]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.03}
      shadow-radius={4}
    />
  );
}

const DIR = new THREE.Vector3(1, 0.86, 1).normalize();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Kameraet står fast i vinkel, men glir og zoomer mellom stegene. */
function CameraRig({
  layout,
  shot,
  inset,
  reduced,
}: {
  layout: Layout;
  shot: Shot;
  inset: WorldProps["inset"];
  reduced: boolean;
}) {
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3());
  const zoom = useRef(0);
  const dir = useMemo(() => new THREE.Vector3(), []);

  // Mål for kameraet regnes bare ut når steg, oppsett eller skjerm endres.
  const goal = useMemo(() => {
    const box = focusBox(layout, shot);
    const right = new THREE.Vector3(1, 0, -1).normalize();
    const up = new THREE.Vector3().crossVectors(right, DIR).negate().normalize();
    let minR = Infinity,
      maxR = -Infinity,
      minU = Infinity,
      maxU = -Infinity;
    const v = new THREE.Vector3();
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          v.set(x, y, z);
          const r = v.dot(right);
          const u = v.dot(up);
          minR = Math.min(minR, r);
          maxR = Math.max(maxR, r);
          minU = Math.min(minU, u);
          maxU = Math.max(maxU, u);
        }
    const availW = Math.max(200, size.width - inset.left - 24);
    const availH = Math.max(200, size.height - inset.top - inset.bottom - 24);
    const z = Math.min(availW / (maxR - minR), availH / (maxU - minU));
    // Flytt midten så scenen havner i den ledige delen av skjermen.
    const t = box
      .getCenter(new THREE.Vector3())
      .addScaledVector(right, -inset.left / 2 / z)
      .addScaledVector(up, (inset.top - inset.bottom) / 2 / z);
    return { zoom: z, target: t };
  }, [layout, shot, size.width, size.height, inset.left, inset.top, inset.bottom]);

  useFrame(({ clock }, dt) => {
    const cam = camera as THREE.OrthographicCamera;
    const first = zoom.current === 0;
    const k = first || reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 2.2);
    zoom.current += (goal.zoom - zoom.current) * k;
    if (first) target.current.copy(goal.target);
    else target.current.lerp(goal.target, k);

    // Lett, langsom svai så verdenen føles levende
    const sway = reduced ? 0 : Math.sin(clock.elapsedTime * 0.08) * 0.05;
    dir.copy(DIR).applyAxisAngle(Y_AXIS, sway);
    cam.position.copy(target.current).addScaledVector(dir, 200);
    cam.zoom = zoom.current;
    cam.lookAt(target.current);
    cam.updateProjectionMatrix();
  });

  return null;
}

function focusBox(l: Layout, shot: Shot): THREE.Box3 {
  const { bounds: b, building: bd, bays } = l;
  const lastZ = bays[bays.length - 1]?.z ?? 8;
  switch (shot) {
    case "fleet":
      return new THREE.Box3(new THREE.Vector3(l.xIn - TURN_R / 2, 0, 1), new THREE.Vector3(l.xOut + TURN_R / 2, 5, lastZ + 5));
    case "roof":
      return new THREE.Box3(new THREE.Vector3(-bd.w / 2, 0, -bd.d - 1), new THREE.Vector3(Math.max(bd.w / 2 + 2, l.crane.x + 3), bd.h + 4, 8));
    case "energy":
      return new THREE.Box3(
        new THREE.Vector3(b.minX + 2, 0, -bd.d * 0.75),
        new THREE.Vector3(l.chargerX + 4, 4, Math.min(lastZ + 2, 22)),
      );
    case "hero":
      return new THREE.Box3(new THREE.Vector3(b.minX + 6, 0, -bd.d), new THREE.Vector3(b.maxX - 4, bd.h, l.roadZ));
    default:
      return new THREE.Box3(new THREE.Vector3(b.minX + 4, 0, b.minZ), new THREE.Vector3(b.maxX - 2, bd.h, b.maxZ - 2));
  }
}
