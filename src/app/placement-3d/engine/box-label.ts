import {
  DoubleSide,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three';
import type { PlacedBox } from '../types';
import type { ScenePalette } from './palette';
import { createTextTexture } from './text-texture';

/** Etiketin yüzeyden kaç mm dışarıda durduğu (z-fighting'e girmemesi için). */
const FACE_OFFSET_MM = 1.2;

/**
 * Yazının yön değiştirme eşiği. Etiket, kamera ile birlikte sürekli dönmez;
 * mevcut yön ile en iyi yön arasındaki fark bu değeri geçince 90° döner.
 * (0.2 ≈ 11.5°, yani geçiş 45° ± ~12° bandında, titremesiz olur.)
 */
const UP_SWITCH_HYSTERESIS = 0.2;

/** Yüz değiştirme eşiği: yeni eksen mevcut eksenden bu oranda büyük olmalı. */
const FACE_SWITCH_RATIO = 1.12;

/** Yatay yüzde yazının bakabileceği 4 yön (kamera sabitken bunlar arasında kalır). */
const UP_CANDIDATES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];

const normal = new Vector3();
const up = new Vector3();
const right = new Vector3();
const basis = new Matrix4();
const rotation = new Quaternion();

/**
 * Paket kimliğini kutunun **tek bir yüzeyine yapıştırılmış düzlem** olarak gösterir.
 *
 * - Billboard (sprite) değildir: yazı hiçbir açıda kutunun içine girmez.
 * - Kameranın baktığı yüz seçilir (üst / ön / arka / sol / sağ) ve etiket o yüzeye taşınır.
 * - Yazı yönü 90°'lik sabit yönlere kilitlidir: kamera hafifçe dönerken yazı dönmez,
 *   ancak açı eşiği geçildiğinde diğer yöne atlar.
 * - Etiket, yüzeyin okuma yönündeki üst-sol köşesine hizalanır.
 */
export class BoxLabel {
  readonly mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;

  private readonly center: Vector3;
  private readonly size: Vector3;
  private readonly aspect: number;

  private axis: 'x' | 'y' | 'z' | '' = '';
  private sign = 1;
  private upIndex = -1;

  constructor(box: PlacedBox, center: Vector3, palette: ScenePalette) {
    const text = createTextTexture(String(box.id), {
      fill: hex(palette.boxLabelFill),
      stroke: hex(palette.boxLabelStroke),
      fontWeight: 500,
    });

    this.aspect = text.aspect;
    this.center = center.clone();
    this.size = new Vector3(box.length, box.width, box.height);

    this.mesh = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({
        map: text.texture,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      })
    );
    this.mesh.name = `label-${box.id}`;
    this.mesh.renderOrder = 4;
  }

  /** Kameranın kargo uzayındaki konumuna göre etiketi uygun yüzeye ve köşeye yerleştirir. */
  update(cameraPosition: Vector3): void {
    const dx = cameraPosition.x - this.center.x;
    const dy = cameraPosition.y - this.center.y;
    const dz = cameraPosition.z - this.center.z;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const az = Math.abs(dz);

    const axis = this.pickAxis(ax, ay, az);

    if (axis === 'z') {
      if (Math.abs(dz) > 1e-3) this.sign = dz >= 0 ? 1 : -1;
      normal.set(0, 0, this.sign);
      // Yatay yüz: yazı dört sabit yönden birine bakar (sürekli dönmez).
      up.set(...this.pickUpDirection(dx, dy), 0);
    } else if (axis === 'x') {
      if (Math.abs(dx) > 1e-3) this.sign = dx >= 0 ? 1 : -1;
      normal.set(this.sign, 0, 0);
      up.set(0, 0, 1);
    } else {
      if (Math.abs(dy) > 1e-3) this.sign = dy >= 0 ? 1 : -1;
      normal.set(0, this.sign, 0);
      up.set(0, 0, 1);
    }

    right.crossVectors(up, normal).normalize();
    up.crossVectors(normal, right).normalize();
    basis.makeBasis(right, up, normal);
    rotation.setFromRotationMatrix(basis);
    this.mesh.quaternion.copy(rotation);

    const halfExtent =
      (Math.abs(normal.x) * this.size.x +
        Math.abs(normal.y) * this.size.y +
        Math.abs(normal.z) * this.size.z) /
      2;

    // Yazının gerçekten kaç mm yer kaplayabileceği: yüzün, yazı yönlerine düşen boyu.
    const widthAlong =
      Math.abs(right.x) * this.size.x +
      Math.abs(right.y) * this.size.y +
      Math.abs(right.z) * this.size.z;
    const heightAlong =
      Math.abs(up.x) * this.size.x +
      Math.abs(up.y) * this.size.y +
      Math.abs(up.z) * this.size.z;

    const margin = Math.min(widthAlong, heightAlong) * 0.06;
    const maxWidth = Math.max(1, widthAlong - margin * 2);
    const maxHeight = Math.max(1, heightAlong * 0.34);

    let height = Math.min(maxHeight, maxWidth / this.aspect);
    let width = height * this.aspect;
    if (width > maxWidth) {
      width = maxWidth;
      height = width / this.aspect;
    }
    this.mesh.scale.set(width, height, 1);

    // Çapa: yazının sol-üst köşesi, dikdörtgenin sol-üst köşesinden `margin` içeride.
    // Böylece metin hiçbir zaman kendi dikdörtgeninin dışına taşmaz.
    const offsetRight = widthAlong / 2 - margin - width / 2;
    const offsetUp = heightAlong / 2 - margin - height / 2;

    this.mesh.position
      .copy(normal)
      .multiplyScalar(halfExtent + FACE_OFFSET_MM)
      .addScaledVector(right, -offsetRight)
      .addScaledVector(up, offsetUp);
  }

  /**
   * Hangi yüze yazılacağını seçer. Mevcut eksen hâlâ makul ölçüde baskınsa
   * (FACE_SWITCH_RATIO) değiştirmez — sınırda titremeyi önler.
   */
  private pickAxis(ax: number, ay: number, az: number): 'x' | 'y' | 'z' {
    let axis: 'x' | 'y' | 'z';
    let value: number;

    if (az >= ax && az >= ay) {
      axis = 'z';
      value = az;
    } else if (ax >= ay) {
      axis = 'x';
      value = ax;
    } else {
      axis = 'y';
      value = ay;
    }

    if (this.axis) {
      const current = this.axis === 'x' ? ax : this.axis === 'y' ? ay : az;
      if (value < current * FACE_SWITCH_RATIO) {
        return this.axis;
      }
    }

    this.axis = axis;
    return axis;
  }

  /**
   * Yatay yüzde yazının bakacağı yönü seçer. Aday yönler 90° aralıklıdır;
   * mevcut yön ile en iyi yön arasındaki fark eşiği geçmedikçe yön korunur.
   */
  private pickUpDirection(dx: number, dy: number): [number, number] {
    const horizontal = Math.hypot(dx, dy);
    const targetX = horizontal > 1e-6 ? -dx / horizontal : 0;
    const targetY = horizontal > 1e-6 ? -dy / horizontal : 1;

    let bestIndex = 0;
    let bestDot = -Infinity;
    for (let index = 0; index < UP_CANDIDATES.length; index++) {
      const candidate = UP_CANDIDATES[index];
      const dot = candidate[0] * targetX + candidate[1] * targetY;
      if (dot > bestDot) {
        bestDot = dot;
        bestIndex = index;
      }
    }

    if (this.upIndex >= 0) {
      const current = UP_CANDIDATES[this.upIndex];
      const currentDot = current[0] * targetX + current[1] * targetY;
      if (bestDot - currentDot < UP_SWITCH_HYSTERESIS) {
        bestIndex = this.upIndex;
      }
    }

    this.upIndex = bestIndex;
    return [UP_CANDIDATES[bestIndex][0], UP_CANDIDATES[bestIndex][1]];
  }
}

function hex(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}
