import { useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { Box3, Mesh, Vector3, type Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { CompanionState } from "./behavior";
import { Breath } from "./Breath";
import { Eyelids } from "./Eyelids";
import { Gaze } from "./Gaze";
import { Paws } from "./Paws";
import { smoothing, useSquash } from "./pose";

/** Rutas dentro de `public/` (modelos optimizados). */
const AWAKE_URL = "/models/xolo.glb";
const ASLEEP_URL = "/models/xolo-dormido.glb";
/** Mayor dimensión de cada modelo en unidades de escena (1 unidad ≈ 113 px). */
const AWAKE_SIZE = 1.76;
// La cabeza (separación entre ojos, con perspectiva de la cámara) mide lo mismo que despierto.
// Medido: ojos 0,419 en el dormido (xy: 1,063 de ancho) y 0,0515 en el despierto; el morro del
// dormido queda en el plano central. Si cambia algún modelo hay que repetir la medida.
const ASLEEP_SIZE = 2.035;
/** Al cambiar de modelo, el nuevo "rebota" (blandito) durante ~0,4 s. */
const POP = (t: number) => 1 - 0.12 * Math.exp(-9 * t) * Math.cos(16 * t);

// Carga ambos modelos al arrancar para que el cambio al dormir no deje un hueco en blanco.
useLoader.preload(GLTFLoader, AWAKE_URL);
useLoader.preload(GLTFLoader, ASLEEP_URL);

/** Un modelo glTF escalado y centrado. `rotationY` orienta el modelo hacia la cámara. */
function Model({
  url,
  size,
  rotationY = 0,
  fit = "xyz",
  yaw,
  look,
  yawLimit = Math.PI,
  children,
}: {
  url: string;
  size: number;
  rotationY?: number;
  /** Ejes con los que se mide el tamaño: "xy" ignora la profundidad. */
  fit?: "xyz" | "xy";
  /** Giro del usuario (rad); el modelo gira sobre su propio centro, hasta ±`yawLimit`. */
  yaw: MutableRefObject<number>;
  /** Giro adicional automático (rad): mirar hacia donde camina o al cursor. */
  look?: MutableRefObject<number>;
  yawLimit?: number;
  children?: ReactNode;
}) {
  const gltf = useLoader(GLTFLoader, url);
  const pivot = useRef<Group>(null);

  // Trabaja sobre un clon: `gltf` está en la caché de useLoader y no debe modificarse
  // (si se volviera a medir ya escalado, el modelo quedaría diminuto).
  const { scene, scale, offset, shiftZ } = useMemo(() => {
    const scene = gltf.scene.clone(true);
    // Los materiales viven en la caché: garantiza que están opacos (p. ej. tras recargar en caliente).
    scene.traverse((o) => {
      if (o instanceof Mesh && !Array.isArray(o.material)) {
        o.material.transparent = false;
        o.material.opacity = 1;
      }
    });
    scene.rotation.y = rotationY;
    scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(scene);
    const dims = box.getSize(new Vector3());
    const scale = size / Math.max(dims.x, dims.y, fit === "xy" ? 0 : dims.z);
    const offset = box.getCenter(new Vector3()).multiplyScalar(-scale);
    // De frente, la cabeza queda cerca de la cámara y la perspectiva la agranda:
    // se retrasa el modelo para que la punta del morro quede en el plano central.
    // El giro se hace sobre el centro del modelo (pivote), no sobre el morro.
    const shiftZ = fit === "xy" ? -(box.max.z - box.getCenter(new Vector3()).z) * scale : 0;
    return { scene, scale, offset, shiftZ };
  }, [gltf, size, rotationY, fit]);

  useFrame((_, delta) => {
    if (!pivot.current) return;
    // Sin límite: vueltas completas (el ángulo se acumula). Con límite: ángulo en (-π, π] recortado.
    const wrapped = Math.atan2(Math.sin(yaw.current), Math.cos(yaw.current));
    const user = yawLimit >= Math.PI ? yaw.current : Math.max(-yawLimit, Math.min(yawLimit, wrapped));
    const target = user + (look?.current ?? 0);
    pivot.current.rotation.y += (target - pivot.current.rotation.y) * smoothing(delta);
  });

  return (
    <group position={[0, 0, shiftZ]}>
      <group ref={pivot}>
        <primitive object={scene} scale={scale} position={offset}>
          {children}
        </primitive>
      </group>
    </group>
  );
}

/** `yaw`: ángulo objetivo (rad) con el que el usuario hace girar a Xolo. */
const LOOK_RANGE_PX = 400; // distancia a la que Xolo nota el cursor
const WALK_TURN = 0.85; // rad (~49°) al caminar hacia un lado
const CURSOR_TURN = 0.55; // rad (~31°) al mirar el cursor
const LOOK_SPEED = 4; // más bajo = giro más lento

interface Inputs {
  /** Giro del usuario con trackpad/⌥ (rad). */
  yaw: MutableRefObject<number>;
  /** Dirección de paseo -1..1. */
  heading: MutableRefObject<number>;
  /** Desplazamiento cursor-centro (px lógicos). */
  cursor: MutableRefObject<{ dx: number; dy: number }>;
}

export function Xolo({ state, yaw, heading, cursor }: { state: CompanionState } & Inputs) {
  const look = useRef(0);
  const anim = useRef<Group>(null);
  const awake = useRef<Group>(null);
  const asleep = useRef<Group>(null);
  const since = useRef(99); // segundos desde el último cambio de modelo
  const shown = useRef(state === "sleeping");
  useSquash(anim, state);

  // Hacia dónde mira: caminando, hacia su destino; en reposo, hacia el cursor si está cerca.
  useFrame((_, delta) => {
    let target = 0;
    if (state === "walking") target = heading.current * WALK_TURN;
    else if (state === "idle" || state === "drowsy") {
      const { dx, dy } = cursor.current;
      if (Math.hypot(dx, dy) < LOOK_RANGE_PX) target = Math.max(-1, Math.min(1, dx / 250)) * CURSOR_TURN;
    }
    look.current += (target - look.current) * (1 - Math.exp(-LOOK_SPEED * delta));
  });

  // Corte directo entre modelos (sin fantasmas) y rebote del que entra.
  useFrame((_, delta) => {
    const sleeping = state === "sleeping";
    if (sleeping !== shown.current) {
      shown.current = sleeping;
      since.current = 0;
    }
    since.current += delta;
    const k = POP(since.current);
    if (awake.current) {
      awake.current.visible = !sleeping;
      awake.current.scale.setScalar(k);
    }
    if (asleep.current) {
      asleep.current.visible = sleeping;
      asleep.current.scale.setScalar(k);
    }
  });

  return (
    <group ref={anim}>
      <group ref={awake}>
        <Model url={AWAKE_URL} size={AWAKE_SIZE} yaw={yaw} look={look}>
          <Gaze state={state} cursor={cursor} />
          <Eyelids state={state} />
          <Paws state={state} />
          <Breath state={state} />
        </Model>
      </group>
      {/* El modelo dormido mira hacia +Z (hacia la cámara): se ve de frente. */}
      <group ref={asleep}>
        <Model url={ASLEEP_URL} size={ASLEEP_SIZE} fit="xy" yaw={yaw} />
      </group>
    </group>
  );
}
