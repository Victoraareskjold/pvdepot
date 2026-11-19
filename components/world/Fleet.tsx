"use client";

import { forwardRef, memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { B, C } from "./parts";
import { P, mat } from "./palette";
import { CHARGER_DX, CHARGER_Z, DOCK_W, REAR_Z, type Layout, type VehicleModel } from "./layout";
import { buildRoutes, MIN_WAIT, newSim, PHASE_STATE, pose, step, type BaySim, type Pose } from "./sim";
import { bayTexture, brandTexture } from "./textures";
import { live } from "./live";
import { ease, mulberry } from "./Ground";

/**
 * Ladeplassene: hver rad har en DC-lader og en lastebil som går i sløyfe:
 * vent, kjør inn, koble til, lad, koble fra, vent på fri utkjøring, kjør ut.
 *
 * Trafikkstyring: bare én bil i innkjøringen og én i utkjøringen om gangen.
 * Bilene holder fast fart på delte strekninger og bremser bare inne i sin
 * egen rad, så de kan ikke kjøre inn i hverandre.
 */

/** Hjulrotasjon følger strekningen bilen har kjørt. */
const wheelDist: number[] = [];

function Fleet({
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
  const n = layout.docks.length;
  const brandMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: brandTexture(accent, energy, "100 % elektrisk"), roughness: 0.5 }),
    [accent, energy],
  );
  const bayMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: bayTexture("#7fd6a8"), roughness: 0.9, transparent: true, opacity: 0.95 }),
    [],
  );

  const routes = useMemo(() => buildRoutes(layout), [layout]);

  const sims = useRef<BaySim[]>([]);
  const locks = useRef({ yard: -1 });
  const trucks = useRef<(THREE.Group | null)[]>([]);
  const cables = useRef<(THREE.Mesh | null)[]>([]);
  const screens = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const bars = useRef<(THREE.Group | null)[]>([]);
  const fills = useRef<(THREE.Mesh | null)[]>([]);
  const glows = useRef<(THREE.Mesh | null)[]>([]);
  const wheels = useRef<THREE.Object3D[][]>([]);

  // Behold bilene som finnes når oppsettet endres; legg bare til eller fjern plasser.
  useEffect(() => {
    const rnd = mulberry(11 + n);
    const list = sims.current;
    if (list.length > n) {
      list.length = n;
    }
    const firstFill = list.length === 0;
    for (let i = list.length; i < n; i++) list.push(newSim(i, firstFill, rnd, reduced));
    // Biler som var på vei inn eller ut da rutene endret seg, starter på nytt utenfor bildet.
    for (const s of list) {
      if (s.phase === "approach" || s.phase === "reverse" || s.phase === "depart") {
        s.phase = "wait";
        s.t = 0;
        s.dur = MIN_WAIT + rnd() * 2;
      }
    }
    locks.current.yard = -1;
    if (live.bays.length !== n) {
      live.bays = list.map((s, i) => ({ id: i + 1, plate: s.plate, state: PHASE_STATE[s.phase], soc: s.soc }));
    }
  }, [layout, n, reduced]);

  const cableGeos = useMemo(
    () =>
      layout.docks.map((d) => {
        // Fra veggladeren ved porten til ladeporten bak på bilens høyre side.
        const socket = new THREE.Vector3(d.x + CHARGER_DX - 0.2, 1.2, CHARGER_Z + 0.2);
        const port = new THREE.Vector3(d.x + 1.28, 1.35, REAR_Z + 1.4);
        const curve = new THREE.CubicBezierCurve3(
          socket,
          new THREE.Vector3(socket.x + 0.1, 0.25, CHARGER_Z + 0.7),
          new THREE.Vector3(port.x + 0.7, 0.2, port.z - 0.2),
          port,
        );
        return new THREE.TubeGeometry(curve, 32, 0.07, 6, false);
      }),
    [layout],
  );

  const colors = useMemo(
    () => ({
      charging: new THREE.Color(P.charge),
      idle: new THREE.Color("#7f8db0"),
      busy: new THREE.Color("#ffc12e"),
      done: new THREE.Color("#4d8bff"),
    }),
    [],
  );

  const ps = useMemo<Pose>(() => ({ visible: false, x: 0, z: 0, yaw: 0 }), []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const time = clock.elapsedTime;
    const list = sims.current;
    if (list.length !== n || routes.length !== n) return;

    step(list, routes, locks.current, dt);

    for (let i = 0; i < n; i++) {
      const s = list[i];
      const g = trucks.current[i];
      if (g) {
        const px = g.position.x;
        const pz = g.position.z;
        pose(s, routes[i], layout.docks[i].x, layout, ps);
        g.visible = ps.visible;
        if (ps.visible) {
          g.position.set(ps.x, 0, ps.z);
          g.rotation.y = ps.yaw;
          const moved = Math.hypot(ps.x - px, ps.z - pz);
          if (moved < 5) wheelDist[i] = (wheelDist[i] ?? 0) + moved;
          const ws = wheels.current[i];
          if (ws) for (const w of ws) w.rotation.z = -(wheelDist[i] ?? 0) / 0.52;
        }
      }

      let cableK = 0;
      const k = s.dur > 0 ? Math.min(1, s.t / s.dur) : 1;
      if (s.phase === "connect") cableK = ease(k);
      else if (s.phase === "charge") cableK = 1;
      else if (s.phase === "disconnect") cableK = 1 - ease(k);

      const cable = cables.current[i];
      if (cable) {
        const geo = cable.geometry as THREE.TubeGeometry;
        const count = geo.index ? geo.index.count : 0;
        geo.setDrawRange(0, Math.floor((count / 6) * cableK) * 6);
        cable.visible = cableK > 0.01;
      }

      const screen = screens.current[i];
      if (screen) {
        const c =
          s.phase === "charge"
            ? colors.charging
            : s.phase === "connect"
              ? colors.busy
              : s.phase === "disconnect" || s.phase === "ready"
                ? colors.done
                : colors.idle;
        screen.emissive.copy(c);
        screen.color.copy(c);
        screen.emissiveIntensity = s.phase === "charge" ? 0.9 + Math.sin(time * 4 + i) * 0.35 : 0.6;
      }

      const bar = bars.current[i];
      if (bar) {
        bar.visible = s.phase === "connect" || s.phase === "charge" || s.phase === "disconnect" || s.phase === "ready";
        const fill = fills.current[i];
        if (fill) {
          const f = Math.max(0.02, s.soc);
          fill.scale.x = f;
          fill.position.x = -1.2 + 1.2 * f;
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

      // Del tilstanden med panelene uten å lage nye objekter hver frame.
      const lb = live.bays[i];
      if (lb) {
        lb.plate = s.plate;
        lb.state = PHASE_STATE[s.phase];
        lb.soc = s.soc;
      }
    }
  });

  return (
    <group>
      {layout.docks.map((d, i) => (
        <group key={i}>
          {/* Malt plass foran rampen med gule styrelinjer */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[d.x, 0.02, layout.parkZ + 0.4]} material={bayMat} receiveShadow>
            <planeGeometry args={[DOCK_W - 1.4, layout.truckLen + 1.2]} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} rotation={[-Math.PI / 2, 0, 0]} position={[d.x + side * 1.75, 0.03, layout.parkZ + 0.4]}>
              <planeGeometry args={[0.14, layout.truckLen + 1.2]} />
              <meshBasicMaterial color={P.lineYellow} />
            </mesh>
          ))}
          {/* Puls på bakken under laderen mens bilen lader */}
          <mesh
            ref={(m) => {
              glows.current[i] = m;
            }}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[d.x + CHARGER_DX, 0.04, 0.9]}
          >
            <ringGeometry args={[0.5, 0.68, 32]} />
            <meshBasicMaterial color={P.charge} transparent opacity={0.4} depthWrite={false} />
          </mesh>
          <Charger
            x={d.x + CHARGER_DX}
            energy={energy}
            screenRef={(m) => {
              screens.current[i] = m;
            }}
          />
          {/* Påkjøringsvern foran laderen */}
          <C p={[d.x + CHARGER_DX, 0.5, 1.05]} s={[0.12, 1, 0.12]} c={P.lineYellow} />
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

export default memo(Fleet);




/* ---------------------------- Lader ---------------------------- */

/** DC-lader montert på veggen ved porten, med skjerm og kabelholder. */
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
      <RoundedBox args={[0.78, 1.25, 0.3]} radius={0.08} smoothness={3} position={[0, 1.55, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={P.charger} roughness={0.35} />
      </RoundedBox>
      <RoundedBox args={[0.84, 0.2, 0.36]} radius={0.06} smoothness={3} position={[0, 2.22, 0]} castShadow>
        <meshStandardMaterial color={energy} roughness={0.4} />
      </RoundedBox>
      {/* Skjerm */}
      <mesh position={[0, 1.78, 0.16]}>
        <planeGeometry args={[0.5, 0.34]} />
        <meshStandardMaterial ref={screenRef} color={P.charge} emissive={P.charge} emissiveIntensity={0.8} />
      </mesh>
      {/* Kontakt og holder */}
      <B p={[0, 1.25, 0.18]} s={[0.2, 0.2, 0.08]} c="#1d2333" />
      {/* Kabelkanal ned i bakken */}
      <B p={[0, 0.48, 0.02]} s={[0.16, 0.95, 0.16]} c="#c6cede" shadow={false} />
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
          {/* Ladeport bak på høyre side, nær rampen (lyser grønt) */}
          <mesh position={[-L / 2 + 1.4, 1.35, -W / 2 - 0.02]}>
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
