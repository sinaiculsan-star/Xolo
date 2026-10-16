import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Color,
  DoubleSide,
  Group,
  Matrix4,
  MathUtils,
  SphereGeometry,
  Vector3,
} from "three";
import type { CompanionState } from "./behavior";
import { EYES } from "./eyes";

/**
 * Parpadeo con párpados postizos: los ojos están pintados en la malla, así que se
 * tapan con una pieza del color de la piel. Posiciones de los ojos en `eyes.ts`.
 */
const LID_RADIUS = 0.0108;
/** Piel del párpado: rosa arriba, crema abajo, como la cara alrededor de los ojos. */
const LID_TOP = "#f4c2c2";
const LID_BOTTOM = "#fbe9e4";
const LASH_COLOR = "#111111";
const BLINK_S = 0.18;
/** Somnoliento: parpadeos largos, casi dormido. */
const DROWSY_BLINK_S = 1.0;

/** Cierre 0..1 a lo largo de un parpadeo de duración `d` (t en segundos). */
const closure = (t: number, d: number) => Math.sin(Math.PI * Math.min(1, t / d)) ** 0.7;
/** Somnoliento: los párpados caen poco a poco (0..1) a lo largo de `t` segundos. */
const droop = (t: number) =>
  0.55 * MathUtils.smoothstep(t, 0, 1.2) + 0.45 * MathUtils.smoothstep(t, 1.9, 2.5);
const nextDelay = () => 2.5 + Math.random() * 3.5;

/** Cúpula (media esfera hacia +Z) con degradado de color en vertical. */
function makeDome() {
  const g = new SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  g.rotateX(Math.PI / 2);
  const pos = g.getAttribute("position");
  const top = new Color(LID_TOP);
  const c = new Color(LID_BOTTOM);
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    c.set(LID_BOTTOM).lerp(top, MathUtils.smoothstep(pos.getY(i), -0.9, 0.9));
    colors.set([c.r, c.g, c.b], 3 * i);
  }
  g.setAttribute("color", new BufferAttribute(colors, 3));
  return g;
}

/**
 * Pestañas: cinta plana pegada a la cúpula, en el borde donde asoma sobre la piel.
 * Más gruesa en la esquina exterior del ojo y afinándose hasta acabar en punta.
 * La anchura va hacia el centro del párpado (el borde inferior queda a ras del párpado).
 */
const LASH_RING = 0.94; // radio relativo de la cúpula donde corta la piel (hipótesis, ver offset -0.0017)
const LASH_ARC = 0.5; // rad que se recortan en cada extremo del arco inferior
const LASH_WIDTH = 0.12; // grosor máximo (en radio relativo de la cúpula)
const LASH_STEPS = 32;
/** Perfil 0..1 a lo largo de la pestaña (t=0: extremo grueso, t=1: punta). */
const lashProfile = (t: number) =>
  (0.6 + 0.4 * MathUtils.smoothstep(t, 0, 0.18)) * Math.pow(1 - t, 0.75);
/** `outerSign`: lado (-1 izquierda, +1 derecha del modelo) de la esquina exterior del ojo. */
function makeLash(outerSign: -1 | 1) {
  const pos: number[] = [];
  const idx: number[] = [];
  const point = (r: number, th: number) => {
    const f = Math.sqrt(Math.max(0, 1 - r * r));
    return [
      LID_RADIUS * 1.02 * r * Math.cos(th),
      -LID_RADIUS + LID_RADIUS * r * Math.sin(th),
      LID_RADIUS * 0.46 * f + LID_RADIUS * 0.012,
    ];
  };
  for (let i = 0; i <= LASH_STEPS; i++) {
    const t = i / LASH_STEPS; // 0 = extremo grueso
    const u = outerSign < 0 ? t : 1 - t; // -x (izquierda) = th cerca de π
    const th = Math.PI + LASH_ARC + u * (Math.PI - 2 * LASH_ARC);
    pos.push(...point(LASH_RING + 0.004, th), ...point(LASH_RING + 0.004 - LASH_WIDTH * lashProfile(t), th));
    if (i < LASH_STEPS) {
      const k = 2 * i;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function Eyelids({ state }: { state: CompanionState }) {
  const lids = useRef<(Group | null)[]>([]);
  const drowsyT = useRef(0);
  const dome = useMemo(makeDome, []);
  const lashes = useMemo(() => [makeLash(-1), makeLash(1)], []);
  const clock = useRef({ wait: nextDelay(), t: -1, double: false });

  // Orientación y pivote de cada párpado (cuelga del borde superior del ojo).
  const placed = useMemo(
    () =>
      EYES.map((e) => {
        const n = new Vector3(...e.n).normalize();
        const up = new Vector3(0, 1, 0).addScaledVector(n, -n.y).normalize();
        const x = new Vector3().crossVectors(up, n).normalize();
        const pos = new Vector3(...e.p).addScaledVector(n, -0.0017).addScaledVector(up, LID_RADIUS);
        return { pos, matrix: new Matrix4().makeBasis(x, up, n) };
      }),
    [],
  );

  useFrame((_, delta) => {
    const c = clock.current;
    const drowsy = state === "drowsy";
    if (drowsy && c.t < 0 && c.wait > 0.6) c.wait = 0.4;
    const dur = drowsy ? DROWSY_BLINK_S : BLINK_S;
    // En vilo (arrastrando) los ojos se quedan abiertos.
    if (state === "dragging") {
      c.t = -1;
    } else if (c.t >= 0) {
      c.t += delta;
      if (c.t >= dur) {
        if (c.double) {
          c.double = false;
          c.t = 0;
        } else {
          c.t = -1;
          c.wait = drowsy ? 0.25 : nextDelay();
        }
      }
    } else {
      c.wait -= delta;
      if (c.wait <= 0) {
        c.t = 0;
        c.double = !drowsy && Math.random() < 0.2;
      }
    }
    drowsyT.current = drowsy ? drowsyT.current + delta : 0;
    const k = Math.max(c.t >= 0 ? closure(c.t, dur) : 0, drowsy ? droop(drowsyT.current) : 0);
    for (const g of lids.current) {
      if (!g) continue;
      g.visible = k > 0.03;
      g.scale.y = Math.max(k, 0.001);
    }
  });

  return (
    <>
      {placed.map((l, i) => (
        <group
          key={i}
          ref={(g) => {
            lids.current[i] = g;
          }}
          position={l.pos}
          visible={false}
          onUpdate={(g) => g.quaternion.setFromRotationMatrix(l.matrix)}
        >
          <mesh geometry={dome} position={[0, -LID_RADIUS, 0]} scale={[LID_RADIUS * 1.02, LID_RADIUS, LID_RADIUS * 0.46]}>
            <meshStandardMaterial vertexColors roughness={0.75} />
          </mesh>
          <mesh geometry={lashes[i]}>
            <meshStandardMaterial color={LASH_COLOR} roughness={0.5} side={DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
          </mesh>
        </group>
      ))}
    </>
  );
}
