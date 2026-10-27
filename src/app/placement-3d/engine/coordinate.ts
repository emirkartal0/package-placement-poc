import { Group, Vector3 } from 'three';
import type { VehicleVolume } from '../types';

/** 1 sahne birimi = 1000 mm = 1 m */
export const MM_PER_SCENE_UNIT = 1000;

export interface CargoFrame {
  /** mm + z-up verisini m + y-up sahneye taşıyan kök grup. */
  readonly root: Group;
  /** Kargo hacminin X/Y merkezi sahnede orijinde, zemin y = 0. */
  readonly content: Group;
  /** Kargo hacminin dünya boyutu (m), y-up. */
  readonly size: Vector3;
  /** Kargo hacminin dünya merkezi (m), y-up. */
  readonly center: Vector3;
}

/**
 * Tüm koordinat dönüşümü burada: algoritma (mm, z-up) → Three.js (m, y-up).
 * Kutular ve kargo kabuğu bu grubun içine *algoritma koordinatlarıyla* eklenir,
 * böylece mesh kodunda hiçbir eksen çevirisi yapılmaz.
 */
export function createCargoFrame(vehicle: VehicleVolume): CargoFrame {
  const root = new Group();
  root.name = 'cargo-frame';
  root.rotation.x = -Math.PI / 2; // z-up → y-up
  root.scale.setScalar(1 / MM_PER_SCENE_UNIT); // mm → m

  const content = new Group();
  content.name = 'cargo-content';
  // Kargo hacmini yatayda sahne orijinine ortala; zemin z=0'da kalsın.
  content.position.set(-vehicle.lengthMm / 2, -vehicle.widthMm / 2, 0);
  root.add(content);

  const size = new Vector3(
    vehicle.lengthMm,
    vehicle.heightMm,
    vehicle.widthMm
  ).multiplyScalar(1 / MM_PER_SCENE_UNIT);

  return { root, content, size, center: new Vector3(0, size.y / 2, 0) };
}
