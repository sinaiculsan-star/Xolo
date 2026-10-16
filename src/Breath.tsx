import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, type BufferAttribute, type InterleavedBufferAttribute } from "three";
import type { CompanionState } from "./behavior";
import { acquireGeometry, releaseGeometry } from "./deform";
import { smoothing } from "./pose";

/**
 * Respiración sin esqueleto: en reposo solo se hincha el cuerpo (por debajo del cuello);
 * la cabeza queda quieta. Pesos por altura, calculados una vez.
 * Coordenadas en el espacio de xolo.glb (sin escalar): la cabeza va de y≈+0,06 a y≈-0,024
 * y el cuerpo (torso, patas, cola hacia atrás) por debajo; hay que repetirlo si cambia el modelo.
 */
const NECK_TOP = -0.022; // por encima: cabeza, sin movimiento
const NECK_BOTTOM = -0.034; // por debajo: cuerpo con todo el efecto
const GROUND_TOP = -0.045; // hacia la base el efecto baja (los pies no flotan)
const GROUND_BOTTOM = -0.06;
const CENTER_X = -0.0125; // eje del cuerpo (centro en x/z)
const CENTER_Z = -0.015;
const EXPAND = 0.045; // cuánto se ensancha el cuerpo al inspirar (fracción)
const RISE = 0.0012; // cuánto sube el pecho
const BREATH_RAD_S = 1.9; // ≈3,3 s por respiración

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type Position = BufferAttribute | InterleavedBufferAttribute;

interface Rig {
  mesh: Mesh;
  pos: Position;
  /** Vértices con peso > 0: índice, posición original (x,y,z) y peso. */
  idx: Uint32Array;
  base: Float32Array;
  weight: Float32Array;
}

function buildRig(mesh: Mesh): Rig {
  const pos = acquireGeometry(mesh).getAttribute("position") as Position;
  const idx: number[] = [];
  const base: number[] = [];
  const weight: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const w = smooth(NECK_TOP, NECK_BOTTOM, y) * (1 - 0.7 * smooth(GROUND_TOP, GROUND_BOTTOM, y));
    if (w <= 0) continue;
    idx.push(i);
    base.push(pos.getX(i), y, pos.getZ(i));
    weight.push(w);
  }
  return { mesh, pos, idx: Uint32Array.from(idx), base: Float32Array.from(base), weight: Float32Array.from(weight) };
}

/** Hijo del modelo despierto: hace respirar el cuerpo de la malla que lo contiene. */
export function Breath({ state }: { state: CompanionState }) {
  const anchor = useRef<Group>(null);
  const rig = useRef<Rig | null>(null);
  const amount = useRef(0); // 0 = quieto, 1 = respirando

  useEffect(() => {
    let mesh: Mesh | undefined;
    anchor.current?.parent?.traverse((o) => {
      if (!mesh && o instanceof Mesh) mesh = o;
    });
    if (!mesh) return;
    const r = buildRig(mesh);
    rig.current = r;
    return () => {
      releaseGeometry(r.mesh);
      rig.current = null;
    };
  }, []);

  useFrame(({ clock }, delta) => {
    const r = rig.current;
    if (!r) return;
    const target = state === "idle" ? 1 : 0;
    const prev = amount.current;
    amount.current += (target - prev) * smoothing(delta);
    if (amount.current < 0.002 && prev < 0.002) return; // quieto: nada que actualizar
    const a = amount.current < 0.002 ? 0 : amount.current;
    const e = a * (0.5 - 0.5 * Math.cos(clock.elapsedTime * BREATH_RAD_S)); // 0..1
    for (let k = 0; k < r.idx.length; k++) {
      const w = r.weight[k] * e;
      const x = r.base[3 * k];
      const z = r.base[3 * k + 2];
      const grow = 1 + w * EXPAND;
      r.pos.setXYZ(
        r.idx[k],
        CENTER_X + (x - CENTER_X) * grow,
        r.base[3 * k + 1] + w * RISE,
        CENTER_Z + (z - CENTER_Z) * grow,
      );
    }
    r.pos.needsUpdate = true;
  });

  return <group ref={anchor} />;
}
