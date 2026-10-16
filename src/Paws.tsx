import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, type BufferAttribute, type InterleavedBufferAttribute } from "three";
import type { CompanionState } from "./behavior";
import { acquireGeometry, releaseGeometry } from "./deform";
import { smoothing } from "./pose";

/**
 * Patitas que se mueven al caminar, sin esqueleto: se desplazan los vértices cercanos a cada
 * pie (pesos calculados una vez). Pies = [x, z, desfase]; las patas en diagonal van juntas.
 * Coordenadas en el espacio de xolo.glb (sin escalar); hay que repetirlas si cambia el modelo.
 */
const FEET: readonly (readonly [number, number, number])[] = [
  [-0.012, 0.03, 0], // delantera izquierda
  [0.02, 0.03, Math.PI], // delantera derecha
  [-0.02, 0.008, Math.PI], // trasera izquierda
  [0.012, -0.012, 0], // trasera derecha
];
const LIFT = 0.007; // cuánto sube la pata que se levanta
const SWING = 0.003; // vaivén adelante/atrás
const STRIDE_RAD_S = 8; // igual que el rebote de `pose.ts` (cada paso = un rebote)

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type Position = BufferAttribute | InterleavedBufferAttribute;

interface Rig {
  mesh: Mesh;
  pos: Position;
  base: Float32Array;
  foot: Int8Array;
  weight: Float32Array;
}

function buildRig(mesh: Mesh): Rig {
  // La geometría vive en la caché de useLoader: se trabaja sobre una copia compartida.
  const geometry = acquireGeometry(mesh);
  const pos = geometry.getAttribute("position") as Position;
  const n = pos.count;
  const base = new Float32Array(n * 3);
  const foot = new Int8Array(n);
  const weight = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    base[3 * i] = x;
    base[3 * i + 1] = y;
    base[3 * i + 2] = z;
    let best = 0;
    let bestDist = Infinity;
    FEET.forEach((f, k) => {
      const d = Math.hypot(x - f[0], z - f[1]);
      if (d < bestDist) {
        bestDist = d;
        best = k;
      }
    });
    foot[i] = best;
    weight[i] = smooth(-0.036, -0.052, y) * (1 - smooth(0.01, 0.018, bestDist));
  }
  return { mesh, pos, base, foot, weight };
}

/** Hijo del modelo despierto: anima los pies de la malla que lo contiene. */
export function Paws({ state }: { state: CompanionState }) {
  const anchor = useRef<Group>(null);
  const rig = useRef<Rig | null>(null);
  const amount = useRef(0); // 0 = quieto, 1 = andando

  useEffect(() => {
    const root = anchor.current?.parent;
    let mesh: Mesh | undefined;
    root?.traverse((o) => {
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
    const target = state === "walking" ? 1 : 0;
    const prev = amount.current;
    amount.current += (target - prev) * smoothing(delta);
    if (amount.current < 0.002 && prev < 0.002) return; // quieto: nada que actualizar
    const a = amount.current < 0.002 ? 0 : amount.current;
    const phase = clock.elapsedTime * STRIDE_RAD_S;
    const n = r.pos.count;
    for (let i = 0; i < n; i++) {
      const w = r.weight[i];
      const x = r.base[3 * i];
      const y = r.base[3 * i + 1];
      const z = r.base[3 * i + 2];
      if (w === 0) continue;
      const s = Math.sin(phase + FEET[r.foot[i]][2]);
      r.pos.setXYZ(i, x, y + w * a * LIFT * Math.max(0, s), z + w * a * SWING * s);
    }
    r.pos.needsUpdate = true;
  });

  return <group ref={anchor} />;
}
