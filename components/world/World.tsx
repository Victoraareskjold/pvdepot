"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { computeLayout, CHARGER_Z, type Layout, type WorldParams } from "./layout";
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
  useEffect(() => {
    setSmall(window.innerWidth < 760);
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
      dpr={small ? [1, 1.5] : [1, 2]}
      camera={{ position: [80, 70, 80], zoom: 10, near: -500, far: 1000 }}
      gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, powerPreference: "high-performance" }}
      aria-hidden
    >
      <color attach="background" args={[P.ground]} />
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
  const right = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(), []);

  const box = useMemo(() => focusBox(layout, shot), [layout, shot]);

  useFrame(({ clock }, dt) => {
    const cam = camera as THREE.OrthographicCamera;
    // Kameraets akser
    right.set(1, 0, -1).normalize();
    up.crossVectors(right, DIR).negate().normalize();

    // Hvor stort utsnitt trengs for boksen?
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
    const wantZoom = Math.min(availW / (maxR - minR), availH / (maxU - minU));

    const center = box.getCenter(new THREE.Vector3());
    // Flytt midten så scenen havner i den ledige delen av skjermen.
    const ox = inset.left / 2;
    const oy = (inset.top - inset.bottom) / 2;
    const wantTarget = center
      .clone()
      .addScaledVector(right, -ox / wantZoom)
      .addScaledVector(up, oy / wantZoom);

    const k = zoom.current === 0 || reduced ? 1 : 1 - Math.exp(-dt * 2.2);
    if (zoom.current === 0) zoom.current = wantZoom * 0.82;
    zoom.current += (wantZoom - zoom.current) * k;
    target.current.lerp(wantTarget, k);

    // Lett, langsom svai så verdenen føles levende
    const sway = reduced ? 0 : Math.sin(clock.elapsedTime * 0.08) * 0.05;
    const dir = DIR.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), sway);
    cam.position.copy(target.current).addScaledVector(dir, 200);
    cam.zoom = zoom.current;
    cam.lookAt(target.current);
    cam.updateProjectionMatrix();
  });

  return null;
}

function focusBox(l: Layout, shot: Shot): THREE.Box3 {
  const { bounds: b, building: bd, bays } = l;
  const first = bays[0]?.x ?? 0;
  const last = bays[bays.length - 1]?.x ?? 0;
  switch (shot) {
    case "fleet":
      return new THREE.Box3(new THREE.Vector3(first - 6, 0, CHARGER_Z - 3), new THREE.Vector3(last + 6, 5, l.roadZ + 3));
    case "roof":
      return new THREE.Box3(
        new THREE.Vector3(Math.min(-bd.w / 2, l.crane.x - 3), 0, -bd.d - 1),
        new THREE.Vector3(bd.w / 2 + 2, bd.h + 4, 3),
      );
    case "energy":
      return new THREE.Box3(
        new THREE.Vector3(b.minX + 2, 0, l.transformer.z - 8),
        new THREE.Vector3(Math.max(first + 10, -bd.w / 2 + 20), 4, CHARGER_Z + l.truckLen + 2),
      );
    case "hero":
      return new THREE.Box3(new THREE.Vector3(b.minX + 8, 0, -bd.d), new THREE.Vector3(b.maxX - 4, bd.h, l.roadZ));
    default:
      return new THREE.Box3(new THREE.Vector3(b.minX + 4, 0, b.minZ), new THREE.Vector3(b.maxX - 2, bd.h, b.maxZ - 2));
  }
}
