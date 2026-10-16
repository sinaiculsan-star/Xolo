import type { BufferGeometry, Mesh } from "three";

/**
 * Varios componentes (patitas, respiración) deforman la misma malla. La geometría original
 * vive en la caché de useLoader y no se toca: todos comparten una copia con recuento de usos.
 */
interface Shared {
  original: BufferGeometry;
  users: number;
}
const KEY = "xoloDeform";

export function acquireGeometry(mesh: Mesh): BufferGeometry {
  const shared = mesh.userData[KEY] as Shared | undefined;
  if (shared) {
    shared.users++;
    return mesh.geometry;
  }
  const original = mesh.geometry;
  mesh.userData[KEY] = { original, users: 1 } satisfies Shared;
  mesh.geometry = original.clone();
  return mesh.geometry;
}

export function releaseGeometry(mesh: Mesh): void {
  const shared = mesh.userData[KEY] as Shared | undefined;
  if (!shared || --shared.users > 0) return;
  mesh.geometry.dispose();
  mesh.geometry = shared.original;
  delete mesh.userData[KEY];
}
