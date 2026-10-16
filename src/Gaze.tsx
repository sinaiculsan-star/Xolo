import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { SRGBColorSpace, TextureLoader, type Mesh } from "three";
import type { CompanionState } from "./behavior";
import { EYES, eyeFrame } from "./eyes";
import { GAZE_PATCHES } from "./gazePatches";

/**
 * Mirada: los brillos de los ojos son piezas postizas (los pintados se borraron de la
 * textura de xolo.glb) que se deslizan hacia el cursor dentro del ojo.
 */
const RANGE_PX = 400; // distancia a la que Xolo nota el cursor
const FULL_PX = 250; // desplazamiento del cursor con el que el brillo llega al tope
const MAX_X = 0.0022; // recorrido máximo en el modelo (el ojo mide ~0,02)
const MAX_Y = 0.0016;
const SPEED = 12; // más bajo = mirada más lenta
const LIFT = 0.0008; // separación de la piel para que no la atraviese en los bordes

const URLS = GAZE_PATCHES.map((p) => p.url);
useLoader.preload(TextureLoader, URLS);

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

export function Gaze({
  state,
  cursor,
}: {
  state: CompanionState;
  cursor: MutableRefObject<{ dx: number; dy: number }>;
}) {
  const textures = useLoader(TextureLoader, URLS);
  useMemo(() => textures.forEach((t) => (t.colorSpace = SRGBColorSpace)), [textures]);
  const frames = useMemo(() => EYES.map(eyeFrame), []);
  const meshes = useRef<(Mesh | null)[]>([]);
  const gaze = useRef({ x: 0, y: 0 });

  useFrame((_, delta) => {
    let tx = 0;
    let ty = 0;
    if (state === "idle" || state === "walking" || state === "drowsy") {
      const { dx, dy } = cursor.current;
      if (Math.hypot(dx, dy) < RANGE_PX) {
        tx = clamp1(dx / FULL_PX);
        ty = -clamp1(dy / FULL_PX); // dy crece hacia abajo en pantalla
        const m = Math.hypot(tx, ty);
        if (m > 1) {
          tx /= m;
          ty /= m;
        }
      }
    }
    const k = 1 - Math.exp(-SPEED * delta);
    gaze.current.x += (tx - gaze.current.x) * k;
    gaze.current.y += (ty - gaze.current.y) * k;
    GAZE_PATCHES.forEach((p, i) => {
      meshes.current[i]?.position.set(p.cx + gaze.current.x * MAX_X, p.cy + gaze.current.y * MAX_Y, LIFT);
    });
  });

  return (
    <>
      {GAZE_PATCHES.map((p, i) => (
        <group key={p.url} position={frames[i].position} quaternion={frames[i].quaternion}>
          <mesh
            ref={(m) => {
              meshes.current[i] = m;
            }}
            position={[p.cx, p.cy, LIFT]}
          >
            <planeGeometry args={[p.w, p.h]} />
            <meshStandardMaterial
              map={textures[i]}
              transparent
              depthWrite={false}
              roughness={0.8}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-1}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}
