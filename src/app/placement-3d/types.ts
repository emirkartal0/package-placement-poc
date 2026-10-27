/**
 * Yerleştirme algoritmasının çıktısını tarif eden tipler.
 *
 * Tüm ölçüler milimetre (mm) cinsindendir.
 * Eksen konvansiyonu (algoritma tarafı):
 *   X = uzunluk, Y = genişlik, Z = yükseklik (z-up)
 *   Orijin = kargo alanının sol-ön-alt köşesi
 */
export interface VehicleVolume {
  /** Opsiyonel etiket, ör. "Panelvan · arka kargo hacmi" */
  label?: string;
  /** Kargo alanı uzunluğu — X ekseni (mm) */
  lengthMm: number;
  /** Kargo alanı genişliği — Y ekseni (mm) */
  widthMm: number;
  /** Kargo alanı yüksekliği — Z ekseni (mm) */
  heightMm: number;
}

/** Algoritmanın kargo alanına yerleştirdiği tek bir dikdörtgenler prizması. */
export interface PlacedBox {
  id: string | number;
  /** X konumu (mm) — anlamı `BoxAnchor` ile belirlenir */
  x: number;
  /** Y konumu (mm) */
  y: number;
  /** Z konumu (mm) */
  z: number;
  /** X ekseni boyunca boy (mm) */
  length: number;
  /** Y ekseni boyunca en (mm) */
  width: number;
  /** Z ekseni boyunca yükseklik (mm) */
  height: number;
  /** Ağırlık (kg). Görselleştirmede özet/renk için kullanılabilir. */
  weight?: number;
  /** Opsiyonel renk (#rrggbb). Verilmezse palet sırayla uygulanır. */
  color?: string;
}

/**
 * x/y/z değerlerinin kutunun hangi noktasına ait olduğu.
 *  - `min`    : sol-ön-alt köşe (varsayılan, algoritmalarda en yaygın)
 *  - `center` : kutunun hacim merkezi
 */
export type BoxAnchor = 'min' | 'center';

/** 3D sahnenin renk paleti. */
export type SceneTheme = 'dark' | 'light';
