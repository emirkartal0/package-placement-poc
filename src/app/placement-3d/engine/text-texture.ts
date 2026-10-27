import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

export interface TextTextureOptions {
  fill: string;
  stroke?: string;
  fontWeight?: number;
}

export interface TextTexture {
  texture: CanvasTexture;
  /** genişlik / yükseklik oranı */
  aspect: number;
}

/** Metni canvas'a çizip doku olarak döner (etiketler ve sahne yazıları için ortak). */
export function createTextTexture(text: string, options: TextTextureOptions): TextTexture {
  const fontSize = 128;
  const padding = 24;
  const strokeWidth = options.stroke ? fontSize * 0.07 : 0;
  const fontWeight = options.fontWeight ?? 600;
  const font = `${fontWeight} ${fontSize}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;

  const canvas = document.createElement('canvas');
  const measure = canvas.getContext('2d');
  if (!measure) {
    throw new Error('2D canvas bağlamı oluşturulamadı');
  }
  measure.font = font;

  const width = Math.ceil(measure.measureText(text).width) + padding * 2 + strokeWidth;
  const height = fontSize + padding * 2 + strokeWidth;
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('2D canvas bağlamı oluşturulamadı');
  }
  context.font = font;
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  if (options.stroke) {
    context.lineWidth = strokeWidth;
    context.strokeStyle = options.stroke;
    context.lineJoin = 'round';
    context.strokeText(text, width / 2, height / 2);
  }
  context.fillStyle = options.fill;
  context.fillText(text, width / 2, height / 2);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;

  return { texture, aspect: width / height };
}
