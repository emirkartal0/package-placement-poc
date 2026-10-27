import {
  BoxGeometry,
  BufferGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import type { BoxAnchor, PlacedBox, VehicleVolume } from '../types';
import type { ScenePalette } from './palette';
import { createTextTexture } from './text-texture';

const GRID_STEP_MM = 100;
const GRID_MAJOR_EVERY = 5;

/** Kargo alanının yarı saydam hacmi + kenar çizgileri (algoritma mm koordinatları). */
export function buildCargoShell(vehicle: VehicleVolume, palette: ScenePalette): Group {
  const geometry = new BoxGeometry(vehicle.lengthMm, vehicle.widthMm, vehicle.heightMm);
  const offset = [
    vehicle.lengthMm / 2,
    vehicle.widthMm / 2,
    vehicle.heightMm / 2,
  ] as const;

  const faces = new Mesh(
    geometry,
    new MeshStandardMaterial({
      color: palette.shellFace,
      transparent: true,
      opacity: palette.shellFaceOpacity,
      depthWrite: false,
      side: DoubleSide,
      roughness: 1,
      metalness: 0,
    })
  );
  faces.position.set(...offset);
  faces.renderOrder = 2;

  const edges = new LineSegments(
    new EdgesGeometry(geometry),
    new LineBasicMaterial({
      color: palette.shellEdge,
      transparent: true,
      opacity: palette.shellEdgeOpacity,
      depthWrite: false,
    })
  );
  edges.position.copy(faces.position);
  edges.renderOrder = 3;

  const group = new Group();
  group.name = 'cargo-shell';
  group.add(faces, edges);
  return group;
}

/** Zemin ızgarası: 100 mm ince, 500 mm kalın çizgiler. */
export function buildFloorGrid(vehicle: VehicleVolume, palette: ScenePalette): Group {
  const { lengthMm: length, widthMm: width } = vehicle;
  const minor: number[] = [];
  const major: number[] = [];

  const stepsX = Math.max(1, Math.round(length / GRID_STEP_MM));
  const stepsY = Math.max(1, Math.round(width / GRID_STEP_MM));

  for (let i = 0; i <= stepsX; i++) {
    const x = Math.min(i * GRID_STEP_MM, length);
    const isMajor = i === 0 || i === stepsX || i % GRID_MAJOR_EVERY === 0;
    (isMajor ? major : minor).push(x, 0, 0, x, width, 0);
  }
  for (let j = 0; j <= stepsY; j++) {
    const y = Math.min(j * GRID_STEP_MM, width);
    const isMajor = j === 0 || j === stepsY || j % GRID_MAJOR_EVERY === 0;
    (isMajor ? major : minor).push(0, y, 0, length, y, 0);
  }

  const group = new Group();
  group.name = 'cargo-grid';
  group.add(
    new LineSegments(
      lineGeometry(minor),
      new LineBasicMaterial({
        color: palette.gridMinor,
        transparent: true,
        opacity: palette.gridMinorOpacity,
        depthWrite: false,
      })
    ),
    new LineSegments(
      lineGeometry(major),
      new LineBasicMaterial({
        color: palette.gridMajor,
        transparent: true,
        opacity: palette.gridMajorOpacity,
        depthWrite: false,
      })
    )
  );
  return group;
}

/** Tek bir paketi (gövde + kenar çizgileri) algoritma koordinatlarında üretir. */
export function buildBoxObject(
  box: PlacedBox,
  index: number,
  anchor: BoxAnchor,
  palette: ScenePalette
): Group {
  const color = box.color ?? hexFromNumber(palette.boxes[index % palette.boxes.length]);
  const geometry = new BoxGeometry(box.length, box.width, box.height);

  const body = new Mesh(
    geometry,
    new MeshStandardMaterial({
      color: new Color(color),
      roughness: 0.62,
      metalness: 0.02,
      // Kenar çizgileri yüzeyle z-fighting'a girmesin diye yüzeyi çok hafif geri it.
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
  );
  body.userData['boxId'] = box.id; // ileride raycast/picking için hazır

  const outline = new LineSegments(
    new EdgesGeometry(geometry),
    new LineBasicMaterial({
      color: palette.boxEdge,
      transparent: true,
      opacity: palette.boxEdgeOpacity,
      depthWrite: false,
    })
  );

  const group = new Group();
  group.name = `box-${box.id}`;
  group.add(body, outline);
  group.position.copy(boxCenter(box, anchor));
  return group;
}

/** Kutunun kargo uzayındaki (mm) merkezi — `anchor` konvansiyonuna göre. */
export function boxCenter(box: PlacedBox, anchor: BoxAnchor): Vector3 {
  if (anchor === 'center') {
    return new Vector3(box.x, box.y, box.z);
  }
  return new Vector3(
    box.x + box.length / 2,
    box.y + box.width / 2,
    box.z + box.height / 2
  );
}

/** Sol-ön-alt köşede X/Y/Z yön işaretleri + harf etiketleri. */
export function buildAxisHelper(): Group {
  const group = new Group();
  group.name = 'axis-helper';
  const origin = new Vector3(-320, -320, 0);
  const length = 420;
  const axes = [
    { direction: new Vector3(1, 0, 0), color: 0xd9635f, label: 'X' },
    { direction: new Vector3(0, 1, 0), color: 0x5cbf85, label: 'Y' },
    { direction: new Vector3(0, 0, 1), color: 0x5b8def, label: 'Z' },
  ] as const;

  for (const axis of axes) {
    const end = origin.clone().addScaledVector(axis.direction, length);
    group.add(
      new Line(
        new BufferGeometry().setFromPoints([origin, end]),
        new LineBasicMaterial({
          color: axis.color,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        })
      )
    );
    const label = buildLabelSprite(axis.label, 110, hexFromNumber(axis.color));
    label.position.copy(end).addScaledVector(axis.direction, 95);
    group.add(label);
  }
  return group;
}

/** Aracın hangi ucunun ön olduğunu gösteren etiketler (hacmin üstünde, kutulara binmez). */
export function buildFrontLabels(vehicle: VehicleVolume, palette: ScenePalette): Group {
  const group = new Group();
  group.name = 'front-labels';
  const spriteHeight = Math.min(160, Math.max(96, vehicle.heightMm * 0.11));
  const z = vehicle.heightMm + spriteHeight * 1.2;

  const front = buildLabelSprite('ÖN', spriteHeight, hexFromNumber(palette.label));
  front.position.set(-190, vehicle.widthMm / 2, z);

  const rear = buildLabelSprite('ARKA', spriteHeight, hexFromNumber(palette.label));
  rear.position.set(vehicle.lengthMm + 190, vehicle.widthMm / 2, z);

  group.add(front, rear);
  return group;
}

/** Geometri + materyal + doku temizliği (bellek sızıntısını önlemek için). */
export function disposeObject3D(root: Object3D): void {
  root.traverse((object) => {
    const node = object as Partial<Mesh> & Partial<Sprite>;
    node.geometry?.dispose();
    const material = node.material;
    if (Array.isArray(material)) {
      material.forEach(disposeMaterial);
    } else if (material) {
      disposeMaterial(material);
    }
  });
}

function disposeMaterial(material: Material): void {
  const withMap = material as Material & { map?: Texture | null };
  withMap.map?.dispose();
  material.dispose();
}

function lineGeometry(points: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  return geometry;
}

function hexFromNumber(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

/** Sahne içi sabit yazılar (ÖN/ARKA, X/Y/Z) için billboard sprite. */
function buildLabelSprite(text: string, heightMm: number, color: string): Sprite {
  const { texture, aspect } = createTextTexture(text, { fill: color });

  const sprite = new Sprite(
    new SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.62 })
  );
  sprite.scale.set(heightMm * aspect, heightMm, 1);
  return sprite;
}
