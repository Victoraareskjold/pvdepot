"use client";

import { forwardRef, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { B, C } from "./parts";
import { P, mat } from "./palette";
import { arrivalPath, BAY_W, CHARGER_Z, departPath, reversePath, type Layout, type VehicleModel } from "./layout";
import { bayTexture, brandTexture } from "./textures";
import { live, type BayState } from "./live";
import { ease, mulberry } from "./Ground";

/**
 * Ladeplassene: hver plass har en lader og en lastebil som går i sløyfe:
 * kjør inn, koble til, lad, koble fra, rygg ut, kjør videre, ny bil.
 */

type Phase = "wait" | "arrive" | "connect" | "charge" | "disconnect" | "reverse" | "depart";

const PHASE_STATE: Record<Phase, BayState> = {
  wait: "ledig",
  arrive: "ankommer",
  connect: "kobler",
  charge: "lader",
  disconnect: "ferdig",
  reverse: "rygger",
  depart: "kjorer",
};

interface BaySim {
  phase: Phase;
  t: number;
  dur: number;
  soc: number;
  socStart: number;
  plate: string;
  dist: number;
}

const SPEED = 16;

export default function Fleet({
  layout,
  model,
  accent,
  energy,
  reduced,
}: {
  layout: Layout;
  model: VehicleModel;
  accent: string;
  energy: string;
  reduced: boolean;
}) {
  const n = layout.bays.length;
  const brandMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: brandTexture(accent, energy, "100 % elektrisk"), roughness: 0.5 }),
    [accent, energy],
  );
  const bayMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ map: bayTexture("#7fd6a8"), roughness: 0.9, transparent: true, opacity: 0.95 }),
    [],
  );

  const paths = useMemo(
    () =>
      layout.bays.map((b) => ({
        arrive: arrivalPath(b.x, layout),
        reverse: reversePath(b.x, layout),
        depart: departPath(b.x, layout),
      })),
    [layout],
  );

  const sims = useRef<BaySim[]>([]);
  const trucks = useRef<(THREE.Group | null)[]>([]);
  const cables = useRef<(THREE.Mesh | null)[]>([]);
  const screens = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const bars = useRef<(THREE.Group | null)[]>([]);
  const fills = useRef<(THREE.Mesh | null)[]>([]);
  const glows = useRef<(THREE.Mesh | null)[]>([]);
  const wheels = useRef<THREE.Object3D[][]>([]);

  // Start med en levende scene: noen lader allerede, resten kommer etter hvert.
  useEffect(() => {
    const rnd = mulberry(11 + n);
    sims.current = layout.bays.map((_, i) => {
      const plate = `EL ${String(10 + ((i * 37) % 89)).padStart(2, "0")}${String((i * 523) % 1000).padStart(3, "0")}`;
      if (reduced || i % 3 !== 2) {
        const soc = 0.25 + rnd() * 0.6;
        return { phase: "charge", t: 0, dur: chargeTime(soc, 0.2), soc, socStart: soc, plate, dist: 0 };
      }
      return { phase: "wait", t: 0, dur: 1 + rnd() * 5, soc: 0.2, socStart: 0.2, plate, dist: 0 };
    });
  }, [layout, n, reduced]);

  const cableGeos = useMemo(
    () =>
      layout.bays.map((b) => {
        const socket = new THREE.Vector3(b.x + 1.9, 1.45, CHARGER_Z + 0.35);
        const port = new THREE.Vector3(b.x + 1.3, 1.35, CHARGER_Z + 2.8);
        const curve = new THREE.CubicBezierCurve3(
          socket,
          new THREE.Vector3(b.x + 2.2, 0.15, CHARGER_Z + 0.9),
          new THREE.Vector3(b.x + 1.8, 0.2, CHARGER_Z + 2.5),
          port,
        );
        return new THREE.TubeGeometry(curve, 40, 0.07, 6, false);
      }),
    [layout.bays],
  );

  const tmpP = useMemo(() => new THREE.Vector3(), []);
  const tmpT = useMemo(() => new THREE.Vector3(), []);
  const charging = useMemo(() => new THREE.Color(P.charge), []);
  const idle = useMemo(() => new THREE.Color("#7f8db0"), []);
  const busy = useMemo(() => new THREE.Color("#ffc12e"), []);
  const done = useMemo(() => new THREE.Color("#4d8bff"), []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const time = clock.elapsedTime;
    const list = sims.current;
    if (list.length !== n) return;

    for (let i = 0; i < n; i++) {
      const s = list[i];
      const g = trucks.current[i];
      s.t += dt;

      // Neste fase
      if (s.t >= s.dur) {
        s.t = 0;
        switch (s.phase) {
          case "wait":
            s.phase = "arrive";
            s.dur = paths[i].arrive.getLength() / SPEED;
            s.socStart = s.soc = 0.15 + Math.random() * 0.3;
            break;
          case "arrive":
            s.phase = "connect";
            s.dur = 1.4;
            break;
          case "connect":
            s.phase = "charge";
            s.dur = chargeTime(s.soc, 0.6);
            s.socStart = s.soc;
            break;
          case "charge":
            s.phase = "disconnect";
            s.dur = 1.1;
            s.soc = 1;
            break;
          case "disconnect":
            s.phase = "reverse";
            s.dur = paths[i].reverse.getLength() / 4.5;
            break;
          case "reverse":
            s.phase = "depart";
            s.dur = paths[i].depart.getLength() / SPEED;
            break;
          case "depart":
            s.phase = "wait";
            s.dur = 1.5 + Math.random() * 4;
            s.plate = nextPlate(s.plate);
            break;
        }
      }

      const k = s.t / s.dur;
      let cableK = 0;

      if (g) {
        g.visible = s.phase !== "wait";
        let prevX = g.position.x;
        let prevZ = g.position.z;
        if (s.phase === "arrive") {
          const u = easeOut(k);
          paths[i].arrive.getPointAt(u, tmpP);
          paths[i].arrive.getTangentAt(u, tmpT);
          setTruck(g, tmpP, tmpT, false);
        } else if (s.phase === "reverse") {
          const u = ease(k);
          paths[i].reverse.getPointAt(u, tmpP);
          paths[i].reverse.getTangentAt(u, tmpT);
          setTruck(g, tmpP, tmpT, true);
        } else if (s.phase === "depart") {
          const u = k * k;
          paths[i].depart.getPointAt(u, tmpP);
          paths[i].depart.getTangentAt(u, tmpT);
          setTruck(g, tmpP, tmpT, false);
        } else if (s.phase !== "wait") {
          g.position.set(layout.bays[i].x, 0, layout.parkZ);
          g.rotation.y = Math.PI / 2;
        }
        // Hjulene ruller med strekningen
        const moved = Math.hypot(g.position.x - prevX, g.position.z - prevZ);
        if (moved < 5) s.dist += s.phase === "reverse" ? -moved : moved;
        prevX = g.position.x;
        prevZ = g.position.z;
        const ws = wheels.current[i];
        if (ws) for (const w of ws) w.rotation.z = -s.dist / 0.52;
      }

      if (s.phase === "connect") cableK = ease(k);
      else if (s.phase === "charge") cableK = 1;
      else if (s.phase === "disconnect") cableK = 1 - ease(k);

      if (s.phase === "charge") s.soc = s.socStart + (1 - s.socStart) * k;

      const cable = cables.current[i];
      if (cable) {
        const geo = cable.geometry as THREE.TubeGeometry;
        const count = geo.index ? geo.index.count : 0;
        const segs = Math.floor((count / 6) * cableK) * 6;
        geo.setDrawRange(0, segs);
        cable.visible = cableK > 0.01;
      }

      const screen = screens.current[i];
      if (screen) {
        const c =
          s.phase === "charge" ? charging : s.phase === "connect" ? busy : s.phase === "disconnect" ? done : idle;
        screen.emissive.copy(c);
        screen.color.copy(c);
        screen.emissiveIntensity = s.phase === "charge" ? 0.9 + Math.sin(time * 4 + i) * 0.35 : 0.6;
      }

      const bar = bars.current[i];
      if (bar) {
        bar.visible = s.phase === "connect" || s.phase === "charge" || s.phase === "disconnect";
        const fill = fills.current[i];
        if (fill) {
          fill.scale.x = Math.max(0.02, s.soc);
          fill.position.x = -1.2 + 1.2 * Math.max(0.02, s.soc);
        }
      }

      const glow = glows.current[i];
      if (glow) {
        const on = s.phase === "charge";
        glow.visible = on;
        if (on) {
          const pulse = (time * 0.8 + i * 0.13) % 1;
          glow.scale.setScalar(1 + pulse * 1.6);
          (glow.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - pulse);
        }
      }
    }

    // Del tilstanden med panelene
    live.bays = list.map((s, i) => ({ id: i + 1, plate: s.plate, state: PHASE_STATE[s.phase], soc: s.soc }));
  });

  return (
    <group>
      {layout.bays.map((b, i) => (
        <group key={i}>
          {/* Malt ladeplass */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[b.x, 0.02, layout.parkZ]}
            material={bayMat}
            receiveShadow
          >
            <planeGeometry args={[BAY_W - 0.7, layout.truckLen + 1.6]} />
          </mesh>
          {/* Puls på bakken mens bilen lader */}
          <mesh
            ref={(m) => {
              glows.current[i] = m;
            }}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[b.x + 1.9, 0.04, CHARGER_Z + 0.2]}
          >
            <ringGeometry args={[0.6, 0.8, 32]} />
            <meshBasicMaterial color={P.charge} transparent opacity={0.4} depthWrite={false} />
          </mesh>
          <Charger
            x={b.x + 1.9}
            energy={energy}
            screenRef={(m) => {
              screens.current[i] = m;
            }}
          />
          {/* Påkjøringsvern */}
          <C p={[b.x - 1.6, 0.45, CHARGER_Z + 0.2]} s={[0.12, 0.9, 0.12]} c={P.lineYellow} />
          <mesh
            ref={(m) => {
              cables.current[i] = m;
            }}
            geometry={cableGeos[i]}
            castShadow
          >
            <meshStandardMaterial color="#1d2333" roughness={0.6} />
          </mesh>
          <Truck
            ref={(g) => {
              trucks.current[i] = g;
            }}
            model={model}
            length={layout.truckLen}
            accent={accent}
            brandMat={brandMat}
            onWheels={(ws) => {
              wheels.current[i] = ws;
            }}
            barRef={(g) => {
              bars.current[i] = g;
            }}
            fillRef={(m) => {
              fills.current[i] = m;
            }}
          />
        </group>
      ))}
    </group>
  );
}

function chargeTime(soc: number, base: number) {
  return 4 + (1 - soc) * 13 + base * 4;
}

function nextPlate(p: string) {
  const num = (parseInt(p.slice(-3), 10) + 137) % 1000;
  return `${p.slice(0, -3)}${String(num).padStart(3, "0")}`;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 2.2);

function setTruck(g: THREE.Group, p: THREE.Vector3, t: THREE.Vector3, reversing: boolean) {
  g.position.set(p.x, 0, p.z);
  const tx = reversing ? -t.x : t.x;
  const tz = reversing ? -t.z : t.z;
  g.rotation.y = Math.atan2(-tz, tx);
}

/* ---------------------------- Lader ---------------------------- */

function Charger({
  x,
  energy,
  screenRef,
}: {
  x: number;
  energy: string;
  screenRef: (m: THREE.MeshStandardMaterial | null) => void;
}) {
  return (
    <group position={[x, 0, CHARGER_Z]}>
      <B p={[0, 0.1, 0]} s={[1.1, 0.2, 0.9]} c="#c6cede" />
      <RoundedBox args={[0.85, 2.3, 0.6]} radius={0.12} smoothness={3} position={[0, 1.35, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={P.charger} roughness={0.35} />
      </RoundedBox>
      <RoundedBox args={[0.92, 0.32, 0.66]} radius={0.08} smoothness={3} position={[0, 2.5, 0]} castShadow>
        <meshStandardMaterial color={energy} roughness={0.4} />
      </RoundedBox>
      {/* Skjerm */}
      <mesh position={[0, 1.85, 0.305]}>
        <planeGeometry args={[0.55, 0.42]} />
        <meshStandardMaterial ref={screenRef} color={P.charge} emissive={P.charge} emissiveIntensity={0.8} />
      </mesh>
      {/* Kontakt og holder */}
      <B p={[0, 1.35, 0.33]} s={[0.22, 0.22, 0.08]} c="#1d2333" />
      <B p={[-0.44, 1.2, 0]} s={[0.04, 1.4, 0.5]} c={energy} shadow={false} />
    </group>
  );
}

/* ---------------------------- Lastebil ---------------------------- */

interface TruckProps {
  model: VehicleModel;
  length: number;
  accent: string;
  brandMat: THREE.Material;
  onWheels: (w: THREE.Object3D[]) => void;
  barRef: (g: THREE.Group | null) => void;
  fillRef: (m: THREE.Mesh | null) => void;
}

const Truck = forwardRef<THREE.Group, TruckProps>(function Truck(
  { model, length: L, accent, brandMat, onWheels, barRef, fillRef },
  ref,
) {
  const wheelRefs = useRef<THREE.Object3D[]>([]);
  useEffect(() => onWheels(wheelRefs.current), [onWheels, model]);

  const W = 2.5;
  const cabLen = 2.5;
  const nose = L / 2;
  const axles =
    model === "semi"
      ? [nose - 1.3, nose - 4, nose - 5.2, -L / 2 + 2.6, -L / 2 + 1.4]
      : model === "bus"
        ? [nose - 2.6, -L / 2 + 3]
        : [nose - 1.3, -L / 2 + 2.7, -L / 2 + 1.5];

  wheelRefs.current = [];
  const addWheel = (o: THREE.Object3D | null) => {
    if (o && !wheelRefs.current.includes(o)) wheelRefs.current.push(o);
  };

  return (
    <group ref={ref} visible={false}>
      {/* Chassis */}
      <B p={[0, 0.75, 0]} s={[L - 0.4, 0.35, W - 0.6]} c="#2c3346" />

      {model === "bus" ? (
        <group>
          <RoundedBox args={[L, 3.1, W]} radius={0.35} smoothness={3} position={[0, 2.15, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={P.truckWhite} roughness={0.35} />
          </RoundedBox>
          <B p={[0, 2.55, W / 2 + 0.01]} s={[L - 1.6, 0.95, 0.03]} c={P.glassDark} rough={0.15} shadow={false} />
          <B p={[0, 2.55, -W / 2 - 0.01]} s={[L - 1.6, 0.95, 0.03]} c={P.glassDark} rough={0.15} shadow={false} />
          <B p={[0, 1.35, W / 2 + 0.01]} s={[L - 0.6, 0.35, 0.03]} c={accent} shadow={false} />
          <B p={[0, 1.35, -W / 2 - 0.01]} s={[L - 0.6, 0.35, 0.03]} c={accent} shadow={false} />
          <B p={[nose + 0.01, 2.4, 0]} s={[0.04, 1.6, W - 0.4]} c={P.glassDark} rough={0.15} shadow={false} />
          <B p={[0, 3.75, 0]} s={[L * 0.4, 0.3, W - 0.6]} c="#dfe4ef" />
        </group>
      ) : (
        <group>
          {/* Førerhus */}
          <RoundedBox
            args={[cabLen, 3, W]}
            radius={0.28}
            smoothness={3}
            position={[nose - cabLen / 2, 2.1, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={accent} roughness={0.35} metalness={0.1} />
          </RoundedBox>
          {/* Frontrute og sidevinduer */}
          <B p={[nose + 0.01, 2.75, 0]} s={[0.04, 1.05, W - 0.35]} c={P.glassDark} rough={0.1} shadow={false} />
          <B p={[nose - 0.75, 2.75, W / 2 + 0.01]} s={[0.9, 0.85, 0.03]} c={P.glassDark} rough={0.1} shadow={false} />
          <B p={[nose - 0.75, 2.75, -W / 2 - 0.01]} s={[0.9, 0.85, 0.03]} c={P.glassDark} rough={0.1} shadow={false} />
          {/* Grill og lys */}
          <B p={[nose + 0.02, 1.35, 0]} s={[0.04, 0.6, W - 0.7]} c="#1d2333" shadow={false} />
          <mesh position={[nose + 0.04, 1.05, W / 2 - 0.35]}>
            <boxGeometry args={[0.04, 0.18, 0.38]} />
            <meshStandardMaterial color="#fffbe6" emissive="#fff3c2" emissiveIntensity={0.9} />
          </mesh>
          <mesh position={[nose + 0.04, 1.05, -W / 2 + 0.35]}>
            <boxGeometry args={[0.04, 0.18, 0.38]} />
            <meshStandardMaterial color="#fffbe6" emissive="#fff3c2" emissiveIntensity={0.9} />
          </mesh>
          {/* Speil */}
          <B p={[nose - 0.2, 2.7, W / 2 + 0.25]} s={[0.12, 0.5, 0.08]} c="#1d2333" />
          <B p={[nose - 0.2, 2.7, -W / 2 - 0.25]} s={[0.12, 0.5, 0.08]} c="#1d2333" />
          {/* Takspoiler */}
          <B p={[nose - 1.4, 3.75, 0]} s={[1.1, 0.4, W - 0.2]} c={accent} rough={0.4} />
          {/* Ladeport (lyser grønt) */}
          <mesh position={[nose - 1.2, 1.35, W / 2 + 0.02]}>
            <boxGeometry args={[0.3, 0.3, 0.04]} />
            <meshStandardMaterial color={P.charge} emissive={P.charge} emissiveIntensity={0.7} />
          </mesh>

          {/* Kasse eller trailer */}
          {(() => {
            const start = -L / 2;
            const end = model === "semi" ? nose - 3.1 : nose - cabLen - 0.15;
            const len = end - start;
            const cx = (start + end) / 2;
            const hgt = model === "semi" ? 3.9 : 3.5;
            const y = 1.1 + hgt / 2;
            return (
              <group>
                <RoundedBox args={[len, hgt, W]} radius={0.12} smoothness={2} position={[cx, y, 0]} castShadow receiveShadow>
                  <meshStandardMaterial color={P.truckWhite} roughness={0.45} />
                </RoundedBox>
                <mesh position={[cx, y, W / 2 + 0.015]} material={brandMat}>
                  <planeGeometry args={[len - 0.4, hgt - 0.4]} />
                </mesh>
                <mesh position={[cx, y, -W / 2 - 0.015]} rotation={[0, Math.PI, 0]} material={brandMat}>
                  <planeGeometry args={[len - 0.4, hgt - 0.4]} />
                </mesh>
                {/* Bakdører */}
                <B p={[start - 0.02, y, 0]} s={[0.04, hgt - 0.3, 0.04]} c="#c9d0de" shadow={false} />
                {model === "semi" && <B p={[nose - 4.6, 1.35, 0]} s={[1.6, 0.25, W - 0.8]} c="#3a4560" />}
              </group>
            );
          })()}
        </group>
      )}

      {/* Hjul */}
      {axles.map((ax) =>
        [1, -1].map((side) => (
          <group key={`${ax}${side}`} position={[ax, 0.52, side * (W / 2 - 0.25)]}>
            <group ref={addWheel}>
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow material={mat(P.tire, { rough: 0.9 })}>
                <cylinderGeometry args={[0.52, 0.52, 0.42, 18]} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * 0.22]} material={mat(P.rim, { rough: 0.4, metal: 0.4 })}>
                <cylinderGeometry args={[0.26, 0.26, 0.02, 12]} />
              </mesh>
              <B p={[0, 0, side * 0.235]} s={[0.44, 0.08, 0.01]} c="#8792a8" shadow={false} />
            </group>
          </group>
        )),
      )}

      {/* Ladestatus over bilen */}
      <group ref={barRef} position={[0, 5.4, 0]} visible={false}>
        <Billboard>
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[2.7, 0.5]} />
            <meshBasicMaterial color="#13233a" transparent opacity={0.85} />
          </mesh>
          <mesh ref={fillRef} position={[-1.2, 0, 0]}>
            <planeGeometry args={[2.4, 0.3]} />
            <meshBasicMaterial color={P.charge} />
          </mesh>
        </Billboard>
      </group>
    </group>
  );
});
