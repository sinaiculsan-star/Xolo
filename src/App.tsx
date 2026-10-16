import { Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { ModelBoundary } from "./ModelBoundary";
import { Sphere } from "./Sphere";
import { Xolo } from "./Xolo";
import { Zzz } from "./Zzz";
import { RADIUS_PX } from "./constants";
import { useClickThrough } from "./useClickThrough";
import { useCompanion } from "./useCompanion";

export function App() {
  const { state, paused, heading, startDrag, holdForMenu } = useCompanion();
  const cursor = useRef({ dx: 9999, dy: 9999 });
  useClickThrough(RADIUS_PX, cursor);
  // Giro: trackpad/rueda sobre Xolo, o Opción (⌥) + arrastrar; vuelve de frente por el camino corto.
  const yaw = useRef(0);
  const settle = () => {
    yaw.current = Math.round(yaw.current / (2 * Math.PI)) * 2 * Math.PI;
  };
  // Giro con el trackpad o la rueda: desliza dos dedos sobre Xolo; vuelve de frente al parar.
  const settleTimer = useRef<number | undefined>(undefined);
  const onWheel = (e: React.WheelEvent) => {
    yaw.current += (e.deltaX + e.deltaY) * 0.01;
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settle, 1500);
  };
  const startSpin = (startX: number) => {
    let lastX = startX;
    const move = (e: MouseEvent) => {
      yaw.current += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      settle();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div
      style={{ width: "100%", height: "100%", position: "relative" }}
      onWheel={onWheel}
      onContextMenu={(e) => {
        e.preventDefault();
        holdForMenu();
        void invoke("show_context_menu", { paused });
      }}
      onMouseDown={(e) => {
        if (e.button === 0 && e.altKey) {
          startSpin(e.clientX);
        } else if (e.button === 0) {
          startDrag();
          void getCurrentWindow().startDragging();
        }
      }}
    >
      {/* flat = sin tonemapping: respeta los colores originales de la textura */}
      <Canvas
        flat
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0, 3.2], fov: 45 }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 4]} intensity={1.6} />
        <ModelBoundary fallback={<Sphere state={state} />}>
          <Suspense fallback={null}>
            <Xolo state={state} yaw={yaw} heading={heading} cursor={cursor} />
          </Suspense>
        </ModelBoundary>
      </Canvas>
      {state === "sleeping" && <Zzz />}
    </div>
  );
}
