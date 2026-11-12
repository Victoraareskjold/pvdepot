"use client";

import type { ThreeElements } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE_ from "three";
import type * as THREE from "three";
import { BOX, CYL, SPHERE, mat } from "./palette";

type V3 = [number, number, number];

interface PartProps {
  p?: V3;
  s?: V3;
  r?: V3;
  c?: string;
  m?: THREE.Material;
  shadow?: boolean;
  receive?: boolean;
  rough?: number;
  metal?: number;
}

/** Boks med posisjon (sentrum), størrelse og farge. */
export function B({ p = [0, 0, 0], s = [1, 1, 1], r, c = "#fff", m, shadow = true, receive = true, rough, metal }: PartProps) {
  return (
    <mesh
      geometry={BOX}
      material={m ?? mat(c, { rough, metal })}
      position={p}
      scale={s}
      rotation={r}
      castShadow={shadow}
      receiveShadow={receive}
    />
  );
}

/** Sylinder: s = [radius, høyde, radius]. */
export function C({ p = [0, 0, 0], s = [1, 1, 1], r, c = "#fff", m, shadow = true, rough, metal }: PartProps) {
  return (
    <mesh
      geometry={CYL}
      material={m ?? mat(c, { rough, metal })}
      position={p}
      scale={s}
      rotation={r}
      castShadow={shadow}
      receiveShadow
    />
  );
}

export function S({ p = [0, 0, 0], s = [1, 1, 1], c = "#fff", m, shadow = true }: PartProps) {
  return (
    <mesh geometry={SPHERE} material={m ?? mat(c)} position={p} scale={s} castShadow={shadow} receiveShadow />
  );
}

export type GroupProps = ThreeElements["group"];

export interface Inst {
  p: V3;
  s: V3;
  c: string;
  r?: V3;
}

const _o = new THREE_.Object3D();
const _c = new THREE_.Color();

/**
 * Mange like former i ett tegnekall (trær, paller, veistriper).
 * Hver forekomst har egen posisjon, størrelse og farge.
 */
export function Instanced({
  items,
  geometry,
  shadow = true,
  basic = false,
}: {
  items: Inst[];
  geometry: THREE.BufferGeometry;
  shadow?: boolean;
  basic?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    items.forEach((it, i) => {
      _o.position.set(...it.p);
      _o.scale.set(...it.s);
      _o.rotation.set(...(it.r ?? [0, 0, 0]));
      _o.updateMatrix();
      im.setMatrixAt(i, _o.matrix);
      im.setColorAt(i, _c.set(it.c));
    });
    im.count = items.length;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh
      key={items.length}
      ref={ref}
      args={[geometry, undefined, Math.max(1, items.length)]}
      castShadow={shadow}
      receiveShadow
    >
      {basic ? <meshBasicMaterial /> : <meshStandardMaterial roughness={0.8} />}
    </instancedMesh>
  );
}
