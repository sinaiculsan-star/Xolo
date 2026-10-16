import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { currentMonitor, getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import type { Window } from "@tauri-apps/api/window";
import {
  chooseAfterIdle,
  clamp,
  idleDurationMs,
  pickWalkTarget,
  sleepDurationMs,
  type CompanionState,
  type Point,
} from "./behavior";
import { RADIUS_PX, WINDOW_PX, ZONE_PX } from "./constants";

const TICK_MS = 33;
const WALK_SPEED_PX_S = 70; // px lógicos por segundo
const DRAG_END_MS = 400; // sin eventos de movimiento durante este tiempo = fin del arrastre
const DROWSY_MS = 2600; // somnoliento antes de dormirse
const MENU_HOLD_MS = 5000; // quieto mientras el menú contextual está abierto

interface Walk {
  x: number; // posición actual (px físicos, esquina superior izquierda de la ventana)
  y: number;
  targetX: number;
  targetY: number;
  k: number; // px físicos por px lógico
}

/** Máquina de estados + movimiento de la ventana. Una sola fuente de verdad del estado. */
export function useCompanion() {
  const [state, setState] = useState<CompanionState>("idle");
  const [paused, setPaused] = useState(false);

  const stateRef = useRef<CompanionState>("idle");
  const pausedRef = useRef(false);
  const untilRef = useRef(performance.now() + idleDurationMs());
  const lastMoveRef = useRef(0);
  const walkRef = useRef<Walk | null>(null);
  const homeRef = useRef<Point | null>(null); // centro de la zona (px físicos, origen de la ventana)
  const busyRef = useRef(false);
  /** Hacia dónde camina: -1 (izquierda) .. 1 (derecha); 0 si no camina. */
  const headingRef = useRef(0);

  const change = useCallback((next: CompanionState, durationMs = 0) => {
    stateRef.current = next;
    if (next !== "walking") headingRef.current = 0;
    untilRef.current = performance.now() + durationMs;
    setState(next);
  }, []);

  /** Empieza un paseo si hay sitio; si no, sigue en reposo. */
  const startWalk = useCallback(
    async (win: Window) => {
      const [mon, pos, size] = await Promise.all([
        currentMonitor(),
        win.outerPosition(),
        win.outerSize(),
      ]);
      if (stateRef.current !== "idle") return; // p. ej. empezó un arrastre mientras esperábamos
      if (!mon) {
        change("idle", idleDurationMs());
        return;
      }
      const k = size.width / WINDOW_PX;
      const margin = (size.width * (WINDOW_PX / 2 - RADIUS_PX)) / WINDOW_PX;
      const wa = mon.workArea;
      // Límites de la pantalla (origen de la ventana) y cuadrado imaginario alrededor de "home".
      const screen = {
        minX: wa.position.x - margin,
        maxX: wa.position.x + wa.size.width - size.width + margin,
        minY: wa.position.y - margin,
        maxY: wa.position.y + wa.size.height - size.height + margin,
      };
      const home = homeRef.current ?? { x: pos.x, y: pos.y };
      homeRef.current = home;
      const half = ((ZONE_PX - 2 * RADIUS_PX) / 2) * k;
      const target = pickWalkTarget(
        { x: pos.x, y: pos.y },
        {
          minX: clamp(home.x - half, screen.minX, screen.maxX),
          maxX: clamp(home.x + half, screen.minX, screen.maxX),
          minY: clamp(home.y - half, screen.minY, screen.maxY),
          maxY: clamp(home.y + half, screen.minY, screen.maxY),
        },
        k,
      );
      if (!target) {
        change("idle", idleDurationMs());
        return;
      }
      walkRef.current = { x: pos.x, y: pos.y, targetX: target.x, targetY: target.y, k };
      headingRef.current = (target.x - pos.x) / Math.hypot(target.x - pos.x, target.y - pos.y);
      change("walking");
    },
    [change],
  );

  const stepWalk = useCallback(
    async (win: Window, dtSec: number) => {
      const w = walkRef.current;
      if (!w) {
        change("idle", idleDurationMs());
        return;
      }
      const dx = w.targetX - w.x;
      const dy = w.targetY - w.y;
      const dist = Math.hypot(dx, dy);
      const step = WALK_SPEED_PX_S * w.k * dtSec;
      const arrived = dist <= step;
      if (arrived) {
        w.x = w.targetX;
        w.y = w.targetY;
      } else {
        w.x += (dx / dist) * step;
        w.y += (dy / dist) * step;
      }
      if (stateRef.current !== "walking") return;
      await win.setPosition(new PhysicalPosition(Math.round(w.x), Math.round(w.y)));
      if (arrived && stateRef.current === "walking") {
        walkRef.current = null;
        change("idle", idleDurationMs());
      }
    },
    [change],
  );

  // Bucle principal.
  useEffect(() => {
    const win = getCurrentWindow();
    let last = performance.now();

    const tick = async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const now = performance.now();
        const dtSec = Math.min((now - last) / 1000, 0.1);
        last = now;
        const s = stateRef.current;

        if (s === "dragging") {
          if (now - lastMoveRef.current > DRAG_END_MS) change("idle", idleDurationMs());
        } else if (pausedRef.current) {
          if (s !== "idle") {
            walkRef.current = null;
            change("idle");
          }
        } else if (s === "idle" && now >= untilRef.current) {
          const next = chooseAfterIdle();
          if (next === "walking") await startWalk(win);
          else if (next === "sleeping") change("drowsy", DROWSY_MS);
          else change("idle", idleDurationMs());
        } else if (s === "drowsy" && now >= untilRef.current) {
          change("sleeping", sleepDurationMs());
        } else if (s === "sleeping" && now >= untilRef.current) {
          change("idle", idleDurationMs());
        } else if (s === "walking") {
          await stepWalk(win, dtSec);
        }
      } catch (e) {
        console.error("companion", e);
        walkRef.current = null;
        if (stateRef.current !== "dragging") change("idle", idleDurationMs());
      } finally {
        busyRef.current = false;
      }
    };

    const id = window.setInterval(() => void tick(), TICK_MS);
    return () => window.clearInterval(id);
  }, [change, startWalk, stepWalk]);

  // Fin del arrastre: mouseup si llega; si no, el temporizador de DRAG_END_MS.
  useEffect(() => {
    const win = getCurrentWindow();
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void win
      .onMoved(() => {
        if (stateRef.current === "dragging") lastMoveRef.current = performance.now();
      })
      .then((u) => {
        if (cancelled) u();
        else unlisten = u;
      });

    const onUp = () => {
      if (stateRef.current === "dragging") change("idle", idleDurationMs());
    };
    window.addEventListener("mouseup", onUp);

    return () => {
      cancelled = true;
      unlisten?.();
      window.removeEventListener("mouseup", onUp);
    };
  }, [change]);

  // Menú contextual (Rust emite "toggle-pause").
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listen("toggle-pause", () => {
      pausedRef.current = !pausedRef.current;
      setPaused(pausedRef.current);
    }).then((u) => {
      if (cancelled) u();
      else unlisten = u;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const startDrag = useCallback(() => {
    walkRef.current = null;
    homeRef.current = null; // la zona se recoloca donde la dejes
    lastMoveRef.current = performance.now();
    change("dragging");
  }, [change]);

  /** Quieto un rato mientras se muestra el menú (no sabemos cuándo se cierra). */
  const holdForMenu = useCallback(() => {
    if (stateRef.current === "walking") {
      walkRef.current = null;
      change("idle", MENU_HOLD_MS);
    } else if (stateRef.current === "idle") {
      untilRef.current = Math.max(untilRef.current, performance.now() + MENU_HOLD_MS);
    }
  }, [change]);

  return { state, paused, heading: headingRef, startDrag, holdForMenu };
}
