"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, type RefObject } from "react";
import * as THREE from "three";
import { CHARGER_Z, type Layout } from "./layout";

export interface PinLabels {
  chargers: string;
  solar?: string;
  battery?: string;
  grid?: string;
}

export interface PinDef {
  id: string;
  position: [number, number, number];
  title: string;
  value: string;
  tone: "charge" | "energy" | "accent" | "warn";
}

/** Hvilke merkelapper som vises, og hvor de henger i verdenen. */
export function pinDefs(layout: Layout, labels: PinLabels): PinDef[] {
  const { building: b, bays, battery, transformer } = layout;
  const out: PinDef[] = [];
  if (bays.length) {
    const mid = (bays[0].x + bays[bays.length - 1].x) / 2;
    out.push({ id: "chargers", position: [mid, 7, CHARGER_Z], tone: "charge", title: "Ladere", value: labels.chargers });
  }
  if (labels.solar) {
    out.push({
      id: "solar",
      position: [b.w * 0.1, b.h + 3, -b.d * 0.45],
      tone: "energy",
      title: "Solceller",
      value: labels.solar,
    });
  }
  if (battery && labels.battery) {
    out.push({ id: "battery", position: [battery.x, 5, battery.z], tone: "charge", title: "Batteri", value: labels.battery });
  }
  if (labels.grid) {
    out.push({
      id: "grid",
      position: [transformer.x, transformer.upgraded ? 5.5 : 4.2, transformer.z - (transformer.upgraded ? 4.2 : 0)],
      tone: transformer.upgraded ? "warn" : "accent",
      title: transformer.upgraded ? "Ny trafo" : "Nettilknytning",
      value: labels.grid,
    });
  }
  return out;
}

/** Flytter DOM-merkelappene til riktig sted på skjermen hver frame. */
export function PinTracker({ pins, refs }: { pins: PinDef[]; refs: RefObject<Map<string, HTMLDivElement>> }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const map = refs.current;
    if (!map) return;
    for (const p of pins) {
      const el = map.get(p.id);
      if (!el) continue;
      v.set(...p.position).project(camera);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
    }
  });
  return null;
}
