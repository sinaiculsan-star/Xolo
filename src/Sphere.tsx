import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, type Mesh, type MeshStandardMaterial } from "three";
import type { CompanionState } from "./behavior";
import { smoothing, useSquash } from "./pose";

const AWAKE = new Color("#ff9ec7");
const ASLEEP = new Color("#c98aa8");

/** Personaje provisional; sirve también de reserva si el modelo 3D no carga. */
export function Sphere({ state }: { state: CompanionState }) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshStandardMaterial>(null);

  useSquash(mesh, state);
  useFrame((_, delta) => {
    material.current?.color.lerp(state === "sleeping" ? ASLEEP : AWAKE, smoothing(delta));
  });

  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[1, 48, 48]} />
      <meshStandardMaterial ref={material} color="#ff9ec7" roughness={0.45} />
    </mesh>
  );
}
