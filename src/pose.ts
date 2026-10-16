import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Object3D } from "three";
import type { CompanionState } from "./behavior";

/** Pose objetivo por estado (escala y desplazamiento vertical). */
export function pose(state: CompanionState, t: number) {
  switch (state) {
    case "walking": {
      const hop = Math.abs(Math.sin(t * 8));
      return { sx: 1 + 0.04 * (1 - hop), sy: 1 - 0.04 * (1 - hop), y: hop * 0.1 };
    }
    case "sleeping": {
      // El modelo dormido ya viene tumbado: solo respira.
      const b = Math.sin(t * 1.2) * 0.015;
      return { sx: 1 + b, sy: 1 - b, y: 0 };
    }
    case "drowsy": {
      const b = Math.sin(t * 1.2) * 0.02;
      return { sx: 1.02 + b, sy: 0.96 - b, y: -0.04 };
    }
    case "dragging":
      return { sx: 0.95, sy: 1.08, y: 0.05 };
    default:
      // En reposo no se mueve el cuerpo entero: respira solo el cuerpo (ver Breath.tsx).
      return { sx: 1, sy: 1, y: 0 };
  }
}

/** Factor de suavizado independiente de los FPS (0..1). */
export const smoothing = (delta: number) => 1 - Math.exp(-12 * delta);

/** Lleva escala y altura de `target` hacia la pose del estado actual. */
export function useSquash(target: RefObject<Object3D | null>, state: CompanionState) {
  useFrame(({ clock }, delta) => {
    const o = target.current;
    if (!o) return;
    const p = pose(state, clock.elapsedTime);
    const a = smoothing(delta);
    o.scale.x += (p.sx - o.scale.x) * a;
    o.scale.y += (p.sy - o.scale.y) * a;
    o.scale.z += (p.sx - o.scale.z) * a;
    o.position.y += (p.y - o.position.y) * a;
  });
}
