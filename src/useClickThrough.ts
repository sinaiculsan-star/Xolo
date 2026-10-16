import { useEffect, type MutableRefObject } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

/**
 * Deja pasar los clics a otras apps salvo cuando el cursor está sobre el
 * personaje (círculo centrado en la ventana). Sondea el cursor global ~60 Hz.
 * radiusPx: radio del personaje en píxeles lógicos.
 * cursor: se actualiza con el desplazamiento cursor-centro (px lógicos) para otros usos (p. ej. mirar al cursor).
 */
export function useClickThrough(radiusPx: number, cursor: MutableRefObject<{ dx: number; dy: number }>) {
  useEffect(() => {
    const win = getCurrentWindow();
    let ignoring: boolean | null = null;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      try {
        // Distancia cursor-centro en puntos lógicos, calculada en Rust (ver cursor_offset).
        const [dx, dy] = await invoke<[number, number]>("cursor_offset");
        cursor.current = { dx, dy };
        const inside = Math.hypot(dx, dy) <= radiusPx;
        const shouldIgnore = !inside;
        if (shouldIgnore !== ignoring) {
          ignoring = shouldIgnore;
          await win.setIgnoreCursorEvents(shouldIgnore);
        }
      } catch (e) {
        console.error("click-through", e);
      }
    };

    const id = window.setInterval(tick, 16);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [radiusPx, cursor]);
}
