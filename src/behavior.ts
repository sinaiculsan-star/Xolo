/** Lógica pura del comportamiento autónomo (sin Tauri ni React). */

/** `drowsy`: somnoliento (parpadeos lentos) justo antes de dormirse. */
export type CompanionState = "idle" | "walking" | "drowsy" | "sleeping" | "dragging";

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

type Rand = () => number;

const between = (min: number, max: number, r: Rand) => min + r() * (max - min);
export const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), Math.max(min, max));

export const idleDurationMs = (r: Rand = Math.random) => between(3000, 8000, r);
export const sleepDurationMs = (r: Rand = Math.random) => between(8000, 20000, r);

/** Qué hacer al acabar un periodo de reposo: 60 % pasear, 25 % dormir, 15 % seguir quieto. */
export function chooseAfterIdle(r: Rand = Math.random): "walking" | "sleeping" | "idle" {
  const x = r();
  if (x < 0.6) return "walking";
  if (x < 0.85) return "sleeping";
  return "idle";
}

/**
 * Destino aleatorio uniforme dentro de `bounds`. `k` = píxeles físicos por píxel lógico.
 * Devuelve null si el trayecto sería minúsculo (< 60 px lógicos).
 */
export function pickWalkTarget(
  from: Point,
  bounds: Bounds,
  k: number,
  r: Rand = Math.random,
): Point | null {
  const x = between(bounds.minX, Math.max(bounds.minX, bounds.maxX), r);
  const y = between(bounds.minY, Math.max(bounds.minY, bounds.maxY), r);
  return Math.hypot(x - from.x, y - from.y) < 60 * k ? null : { x, y };
}
