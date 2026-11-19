"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, type RefObject } from "react";
import * as THREE from "three";
import type { Layout } from "./layout";

export interface PinLabels {
  chargers: string;
  solar?: string;
  battery?: string;
  grid?: string;
  control?: string;
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
  const { building: b, docks, battery, transformer, inverter } = layout;
  const out: PinDef[] = [];
  if (docks.length) {
    const mid = (docks[0].x + docks[docks.length - 1].x) / 2;
    out.push({
      id: "chargers",
      position: [mid, b.h + 0.6, 0.4],
      tone: "charge",
      title: "DC-lading på rampene",
      value: labels.chargers,
    });
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
    const xs = battery.slots.map((sl) => sl.x);
    const zs = battery.slots.map((sl) => sl.z);
    out.push({
      id: "battery",
      position: [(Math.min(...xs) + Math.max(...xs)) / 2, 4.4, (Math.min(...zs) + Math.max(...zs)) / 2],
      tone: "charge",
      title: "Batteri",
      value: labels.battery,
    });
  }
  if (labels.control) {
    out.push({
      id: "control",
      position: [inverter.x, 3.6, inverter.z],
      tone: "energy",
      title: "Inverter og styring",
      value: labels.control,
    });
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
    // Les størrelsene først, skriv etterpå (unngår ekstra layout-beregning).
    // Hele piksler, ellers tegner nettleseren teksten uskarpt.
    const els = pins.map((p) => map.get(p.id));
    const dims = els.map((el) => (el ? [el.offsetWidth, el.offsetHeight] : [0, 0]));
    pins.forEach((p, i) => {
      const el = els[i];
      if (!el) return;
      v.set(...p.position).project(camera);
      const x = Math.round(((v.x + 1) / 2) * size.width - dims[i][0] / 2);
      const y = Math.round(((1 - v.y) / 2) * size.height - dims[i][1]);
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
  });
  return null;
}
