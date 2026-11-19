"use client";

import { memo, useMemo } from "react";
import * as THREE from "three";
import { B, C } from "./parts";
import { P, mat } from "./palette";
import { DOOR_W, hvacUnits, officeWidth, type Layout } from "./layout";
import { signTexture, wallTexture } from "./textures";

/** Lagerbygget: bølgeblikkvegger, kontorfløy i glass, porter og lasteramper. */
function Building({ layout, accent, sign }: { layout: Layout; accent: string; sign: string }) {
  const { w, d, h } = layout.building;

  const wallMats = useMemo(() => {
    const front = wallTexture(P.wall, P.wallRib);
    front.repeat.set(w / 1.4, 1);
    const side = wallTexture(P.wall, P.wallRib);
    side.repeat.set(d / 1.4, 1);
    return {
      front: new THREE.MeshStandardMaterial({ map: front, roughness: 0.7 }),
      side: new THREE.MeshStandardMaterial({ map: side, roughness: 0.7 }),
    };
  }, [w, d]);

  const signMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: signTexture(sign, accent), roughness: 0.5 }),
    [sign, accent],
  );

  const officeW = officeWidth(w);
  const officeX = -w / 2 + officeW / 2;

  return (
    <group>
      {/* Hovedvolum: fasadene får egne materialer med ribber */}
      <mesh position={[0, h / 2, -d / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial attach="material-0" {...matProps(wallMats.side)} />
        <meshStandardMaterial attach="material-1" {...matProps(wallMats.side)} />
        <meshStandardMaterial attach="material-2" color={P.roof} roughness={0.9} />
        <meshStandardMaterial attach="material-3" color={P.roof} />
        <meshStandardMaterial attach="material-4" {...matProps(wallMats.front)} />
        <meshStandardMaterial attach="material-5" {...matProps(wallMats.front)} />
      </mesh>

      {/* Takkant: hvit gesims og blå stripe */}
      <B p={[0, h + 0.25, -d / 2]} s={[w + 0.4, 0.5, d + 0.4]} c={P.parapet} />
      <B p={[0, h - 0.35, 0.03]} s={[w + 0.42, 0.5, 0.12]} c={accent} rough={0.5} />
      <B p={[w / 2 + 0.03, h - 0.35, -d / 2]} s={[0.12, 0.5, d + 0.42]} c={accent} rough={0.5} />
      {/* Takflate litt lavere enn gesimsen, så kanten synes */}
      <B p={[0, h + 0.36, -d / 2]} s={[w - 0.6, 0.1, d - 0.6]} c={P.roof} shadow={false} />

      {/* Takaggregater */}
      {hvacUnits(w, d).map((u, i) => (
        <group key={i} position={[u.x, h + 0.4, u.z]}>
          <B p={[0, 0.6, 0]} s={[u.sx, 1.2, u.sz]} c={P.hvac} />
          <C p={[u.sx * 0.22, 1.25, 0]} s={[0.5, 0.12, 0.5]} c={P.steelDark} />
          <C p={[-u.sx * 0.22, 1.25, 0]} s={[0.5, 0.12, 0.5]} c={P.steelDark} />
        </group>
      ))}

      {/* Kontorfløy i glass foran til venstre */}
      <group position={[officeX, 0, 0.6]}>
        <B p={[0, h * 0.45, 0]} s={[officeW, h * 0.9, 1.4]} c={P.wall} />
        <B p={[0, h * 0.26, 0.72]} s={[officeW - 0.8, h * 0.3, 0.06]} m={glassMat} />
        <B p={[0, h * 0.66, 0.72]} s={[officeW - 0.8, h * 0.3, 0.06]} m={glassMat} />
        {Array.from({ length: Math.floor(officeW / 2.2) }, (_, i) => (
          <B key={i} p={[-officeW / 2 + 1.1 + i * 2.2, h * 0.45, 0.76]} s={[0.12, h * 0.82, 0.05]} c="#ffffff" />
        ))}
        {/* Inngangsparti */}
        <B p={[officeW / 2 - 2.4, 3.1, 1.9]} s={[4, 0.25, 2.6]} c={accent} />
        <C p={[officeW / 2 - 4.1, 1.5, 3]} s={[0.1, 3, 0.1]} c={P.steel} />
        <C p={[officeW / 2 - 0.7, 1.5, 3]} s={[0.1, 3, 0.1]} c={P.steel} />
      </group>

      {/* Skilt over kontoret */}
      <mesh position={[officeX, h + 0.15, 1.38]} material={signMat}>
        <planeGeometry args={[Math.min(10, officeW * 0.8), 1.7]} />
      </mesh>

      {/* Vindusbånd høyt på fasaden */}
      {Array.from({ length: Math.max(0, Math.floor((w - officeW - 4) / 4)) }, (_, i) => (
        <B key={i} p={[-w / 2 + officeW + 3 + i * 4, h - 1.6, 0.05]} s={[2.8, 0.9, 0.08]} m={glassMat} shadow={false} />
      ))}

      {/* Lasteramper på fasaden mot sørvest: port, tettelist og støtfangere */}
      {layout.docks.map((dock, i) => (
        <group key={i} position={[dock.x, 0, 0]}>
          <B p={[0, 2.5, 0.12]} s={[DOOR_W + 0.7, 4.8, 0.24]} c="#2c3346" />
          <B p={[0, 2.75, 0.26]} s={[DOOR_W, 4.2, 0.06]} c={P.door} rough={0.5} />
          {[0, 1, 2, 3, 4, 5, 6].map((k) => (
            <B key={k} p={[0, 1.05 + k * 0.56, 0.3]} s={[DOOR_W, 0.05, 0.02]} c="#5a83e6" shadow={false} />
          ))}
          {/* Rampeplate og støtfangere */}
          <B p={[0, 0.55, 0.45]} s={[DOOR_W - 0.4, 0.1, 0.7]} c={P.steel} />
          <B p={[-1.25, 0.75, 0.55]} s={[0.35, 0.6, 0.5]} c="#1d2333" />
          <B p={[1.25, 0.75, 0.55]} s={[0.35, 0.6, 0.5]} c="#1d2333" />
          {/* Grønt lys: rampen er i bruk til lading */}
          <mesh position={[-DOOR_W / 2 - 0.15, 5.2, 0.3]}>
            <sphereGeometry args={[0.14, 12, 8]} />
            <meshStandardMaterial color="#22c27a" emissive="#22c27a" emissiveIntensity={1.2} />
          </mesh>
          <B p={[0, 5.35, 0.2]} s={[0.6, 0.35, 0.12]} c="#ffffff" shadow={false} />
          {void i}
        </group>
      ))}

      {/* Sidedører på høyre gavl, der gaffeltruckene går */}
      {layout.sideDoors.map((sd, i) => (
        <group key={i} position={[w / 2, 0, sd.z]}>
          <B p={[0.12, 2, 0]} s={[0.24, 4, 3.4]} c="#2c3346" />
          <B p={[0.26, 2, 0]} s={[0.06, 3.6, 3]} c={P.door} rough={0.5} />
        </group>
      ))}

      {/* Nedløpsrør */}
      {[-w / 2 + 0.3, w / 2 - 0.3].map((x, i) => (
        <C key={i} p={[x, h / 2, 0.25]} s={[0.12, h, 0.12]} c={P.steel} />
      ))}
    </group>
  );
}

const glassMat = mat(P.glass, { rough: 0.15, metal: 0.3 });

function matProps(m: THREE.MeshStandardMaterial) {
  return { map: m.map, roughness: m.roughness };
}

export default memo(Building);
