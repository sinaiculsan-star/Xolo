import { Matrix4, Quaternion, Vector3 } from "three";

/**
 * Los ojos están pintados en la malla de xolo.glb. Coordenadas en el espacio del modelo
 * (sin escalar): centro del ojo + normal de la superficie. Medidas con raycast sobre el
 * modelo; si cambia el modelo, hay que repetirlas.
 */
export const EYES = [
  { p: [-0.0245, 0.004, 0.0526], n: [-0.499, 0.04, 0.865] },
  { p: [0.027, 0.0092, 0.0525], n: [0.448, 0.216, 0.868] },
] as const;

/** Marco del ojo: x = derecha del ojo, y = arriba, z = normal de la superficie. */
export function eyeFrame(e: (typeof EYES)[number]) {
  const n = new Vector3(...e.n).normalize();
  const up = new Vector3(0, 1, 0).addScaledVector(n, -n.y).normalize();
  const x = new Vector3().crossVectors(up, n).normalize();
  return {
    position: new Vector3(...e.p),
    quaternion: new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, up, n)),
  };
}
