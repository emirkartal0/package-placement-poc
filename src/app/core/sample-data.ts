import type { PlacedBox, VehicleVolume } from '../placement-3d/types';

export const SAMPLE_VEHICLE: VehicleVolume = {
  label: 'Panelvan · arka kargo hacmi',
  lengthMm: 2400,
  widthMm: 1500,
  heightMm: 1200,
};

/**
 * Gerçekçi e-ticaret paket ölçüleri: [uzunluk, genişlik, yükseklik] mm.
 * Ağırlıklar hacim × rastgele yoğunluk (60–180 kg/m³) ile türetilir.
 */
const CATALOGUE: ReadonlyArray<readonly [number, number, number]> = [
  [600, 400, 300],
  [500, 400, 250],
  [400, 300, 250],
  [700, 400, 350],
  [450, 350, 300],
  [600, 300, 400],
  [550, 450, 250],
  [350, 350, 200],
];

const SEED = 20261027;

/**
 * Deterministik örnek yerleştirme: katman (z) → sıra (y) → paket (x).
 * Aynı seed her zaman aynı sonucu üretir; ekran görüntüleri tekrarlanabilir.
 */
export function generateSamplePacking(): {
  vehicle: VehicleVolume;
  boxes: PlacedBox[];
} {
  const random = createRandom(SEED);
  const boxes: PlacedBox[] = [];
  let index = 1;
  let z = 0;

  while (SAMPLE_VEHICLE.heightMm - z >= 180) {
    const availableHeight = SAMPLE_VEHICLE.heightMm - z;
    const layerOptions = CATALOGUE.filter(([, , height]) => height <= availableHeight);
    if (layerOptions.length === 0) break;

    const layerHeight = Math.max(...layerOptions.map(([, , height]) => height));
    let y = 0;

    while (SAMPLE_VEHICLE.widthMm - y >= 150) {
      const rowOptions = layerOptions.filter(([, width]) => width <= SAMPLE_VEHICLE.widthMm - y);
      if (rowOptions.length === 0) break;

      const row = rowOptions[Math.floor(random() * rowOptions.length)];
      const rowWidth = row[1];
      let x = 0;
      let placedInRow = 0;

      while (SAMPLE_VEHICLE.lengthMm - x >= 150) {
        const fitting = layerOptions.filter(
          ([length, width]) => width === rowWidth && length <= SAMPLE_VEHICLE.lengthMm - x
        );
        if (fitting.length === 0) break;

        const candidate = fitting[Math.floor(random() * fitting.length)];
        const [length, width, height] = candidate;

        // Gerçek algoritma çıktısına benzemesi için ara sıra boşluk bırak.
        if (placedInRow > 0 && random() < 0.07) {
          x += length + 40;
          placedInRow++;
          continue;
        }

        const volumeM3 = (length * width * height) / 1e9;
        boxes.push({
          id: `PKG-${String(index).padStart(3, '0')}`,
          x,
          y,
          z,
          length,
          width,
          height,
          weight: Math.round(volumeM3 * (60 + random() * 120) * 10) / 10,
        });

        index++;
        placedInRow++;
        x += length;
      }

      y += rowWidth;
    }

    z += layerHeight;
  }

  return { vehicle: SAMPLE_VEHICLE, boxes };
}

/** Küçük, deterministik bir lineer eşlemeli üreteç (LCG). */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
