import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import type { BoxAnchor, PlacedBox, SceneTheme, VehicleVolume } from './types';
import { PlacementScene } from './engine/placement-scene';

/**
 * Araç içi yerleştirme sonucunu 3D gösteren standalone bileşen.
 *
 * Kullanım (Angular 19+; standalone varsayılan):
 *   <placement-3d-view [vehicle]="vehicle" [boxes]="boxes" />
 *
 * Girdi verisi: mm cinsinden, z-up (X=uzunluk, Y=genişlik, Z=yükseklik),
 * orijin kargo alanının sol-ön-alt köşesi.
 */
@Component({
  selector: 'placement-3d-view',
  standalone: true,
  templateUrl: './placement-3d-view.html',
  styleUrl: './placement-3d-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Placement3dView implements OnDestroy {
  /** Kargo alanı ölçüleri. */
  readonly vehicle = input.required<VehicleVolume>();
  /** Algoritmanın yerleştirdiği paketler. Yeni bir dizi referansı verilmelidir. */
  readonly boxes = input.required<readonly PlacedBox[]>();
  /** x/y/z'nin kutunun hangi noktası olduğu. Varsayılan: sol-ön-alt köşe. */
  readonly anchor = input<BoxAnchor>('min');
  /** Sahne paleti. */
  readonly theme = input<SceneTheme>('dark');
  /** Kamera kendi etrafında dönsün mü (demo/ekran görüntüsü için). */
  readonly autoRotate = input(false);
  /** Eksen işaretleri ve ÖN/ARKA etiketleri. */
  readonly showHelpers = input(true);
  /** Her paketin köşesine packageId yazılsın mı. */
  readonly showLabels = input(true);
  /** Alt bilgi satırı (ölçü, adet, doluluk, ağırlık). */
  readonly showStats = input(true);

  /** Veriden hesaplanan özet — UI tarafında tekrar hesaplama gerekmez. */
  readonly stats = computed(() => {
    const vehicle = this.vehicle();
    const boxes = this.boxes();
    const cargoVolumeMm3 = vehicle.lengthMm * vehicle.widthMm * vehicle.heightMm;
    let usedMm3 = 0;
    let weightKg = 0;
    for (const box of boxes) {
      usedMm3 += box.length * box.width * box.height;
      weightKg += box.weight ?? 0;
    }
    const usedM3 = usedMm3 / 1e9;
    return {
      dimensions: `${vehicle.lengthMm} × ${vehicle.widthMm} × ${vehicle.heightMm} mm`,
      count: boxes.length,
      usedM3,
      weightKg: Math.round(weightKg),
      fillPercent: cargoVolumeMm3 > 0 ? Math.round((usedMm3 / cargoVolumeMm3) * 100) : 0,
    };
  });

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly zone = inject(NgZone);
  private readonly sceneReady = signal(false);
  private scene: PlacementScene | null = null;

  constructor() {
    effect(() => {
      if (!this.sceneReady()) return;
      this.scene?.setData(this.vehicle(), this.boxes(), this.anchor());
    });
    effect(() => {
      if (!this.sceneReady()) return;
      this.scene?.setTheme(this.theme());
    });
    effect(() => {
      if (!this.sceneReady()) return;
      this.scene?.setShowHelpers(this.showHelpers());
    });
    effect(() => {
      if (!this.sceneReady()) return;
      this.scene?.setShowLabels(this.showLabels());
    });
    effect(() => {
      if (!this.sceneReady()) return;
      this.scene?.setAutoRotate(this.autoRotate());
    });

    afterNextRender(() => {
      // Render döngüsü Angular change detection'ının dışında çalışsın.
      this.zone.runOutsideAngular(() => {
        this.scene = new PlacementScene(this.canvas().nativeElement, this.host().nativeElement, {
          theme: this.theme(),
          autoRotate: this.autoRotate(),
          showHelpers: this.showHelpers(),
          showLabels: this.showLabels(),
        });
      });
      this.sceneReady.set(true);
    });
  }

  ngOnDestroy(): void {
    this.scene?.dispose();
    this.scene = null;
  }
}
