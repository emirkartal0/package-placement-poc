import type { SceneTheme } from '../types';

/** Sahnedeki tüm renk/opaklık kararları tek yerde. */
export interface ScenePalette {
  background: number;
  shellFace: number;
  shellFaceOpacity: number;
  shellEdge: number;
  shellEdgeOpacity: number;
  gridMinor: number;
  gridMinorOpacity: number;
  gridMajor: number;
  gridMajorOpacity: number;
  label: number;
  boxLabelFill: number;
  boxLabelStroke: number;
  boxes: readonly number[];
  boxEdge: number;
  boxEdgeOpacity: number;
  hemiSky: number;
  hemiGround: number;
  ambient: number;
}

export const DARK_PALETTE: ScenePalette = {
  background: 0x0b0f14,
  shellFace: 0x7aa2ff,
  shellFaceOpacity: 0.05,
  shellEdge: 0x8fb4ff,
  shellEdgeOpacity: 0.5,
  gridMinor: 0x8ea3bd,
  gridMinorOpacity: 0.13,
  gridMajor: 0xa7bcd6,
  gridMajorOpacity: 0.26,
  label: 0xc2d2e6,
  boxLabelFill: 0xffffff,
  boxLabelStroke: 0x0b1118,
  boxes: [0x5b8def, 0x4fc08d, 0xe8a33d, 0xd4749e, 0x9a8cf5, 0x45c8d8],
  boxEdge: 0x060a10,
  boxEdgeOpacity: 0.85,
  hemiSky: 0x9dc0ea,
  hemiGround: 0x0c1117,
  ambient: 0x4a5a70,
};

export const LIGHT_PALETTE: ScenePalette = {
  background: 0xf1f5fa,
  shellFace: 0x5a7ba6,
  shellFaceOpacity: 0.05,
  shellEdge: 0x3f5f88,
  shellEdgeOpacity: 0.45,
  gridMinor: 0x5f7186,
  gridMinorOpacity: 0.16,
  gridMajor: 0x44566d,
  gridMajorOpacity: 0.3,
  label: 0x384a5e,
  boxLabelFill: 0xffffff,
  boxLabelStroke: 0x101a24,
  boxes: [0x3b6fd4, 0x2f9e6a, 0xc98524, 0xb04f83, 0x6f5bd6, 0x1f9aa8],
  boxEdge: 0x0b1118,
  boxEdgeOpacity: 0.55,
  hemiSky: 0xffffff,
  hemiGround: 0xd6dde7,
  ambient: 0xa9b6c6,
};

export function paletteFor(theme: SceneTheme): ScenePalette {
  return theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
}
