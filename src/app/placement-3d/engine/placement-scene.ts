import {
  AmbientLight,
  Color,
  DirectionalLight,
  HemisphereLight,
  NoToneMapping,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { BoxAnchor, PlacedBox, SceneTheme, VehicleVolume } from '../types';
import {
  buildAxisHelper,
  buildBoxObject,
  boxCenter,
  buildCargoShell,
  buildFloorGrid,
  buildFrontLabels,
  disposeObject3D,
} from './builders';
import { BoxLabel } from './box-label';
import { createCargoFrame, type CargoFrame } from './coordinate';
import { paletteFor, type ScenePalette } from './palette';

export interface PlacementSceneOptions {
  theme: SceneTheme;
  autoRotate: boolean;
  showHelpers: boolean;
  showLabels: boolean;
}

/** Kamera sığdırma hedefi: kargo hacminin NDC'de kapladığı en büyük oran (1 = ekran kenarı). */
const FIT_NDC = 0.88;

const cameraLocal = new Vector3();

interface SceneData {
  vehicle: VehicleVolume;
  boxes: readonly PlacedBox[];
  anchor: BoxAnchor;
}

/**
 * Angular'dan bağımsız Three.js sahnesi.
 * Tek sorumluluğu: verilen yerleştirme sonucunu çizmek ve yaşam döngüsünü yönetmek.
 */
export class PlacementScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly hemiLight = new HemisphereLight();
  private readonly ambientLight = new AmbientLight();
  private readonly keyLight = new DirectionalLight();
  private readonly fillLight = new DirectionalLight();
  private readonly rimLight = new DirectionalLight();
  private readonly background = new Color();
  private readonly host: HTMLElement;
  private readonly resizeObserver: ResizeObserver;

  private palette: ScenePalette;
  private theme: SceneTheme;
  private showHelpers: boolean;
  private showLabels: boolean;
  private frame: CargoFrame | null = null;
  private readonly labels: BoxLabel[] = [];
  private data: SceneData | null = null;
  private disposed = false;
  /** Kullanıcı kamerayı oynattıysa pencere boyutu değişince otomatik fit yapılmaz. */
  private interacted = false;

  constructor(canvas: HTMLCanvasElement, host: HTMLElement, options: PlacementSceneOptions) {
    this.host = host;
    this.theme = options.theme;
    this.showHelpers = options.showHelpers;
    this.showLabels = options.showLabels;
    this.palette = paletteFor(options.theme);

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    // Ton eşlemesi kapalı: yüzey parlaklıkları doğrudan ışık toplamıyla belirlenir,
    // böylece tüm yüzler öngörülebilir ve eşit aydınlanır.
    this.renderer.toneMapping = NoToneMapping;

    this.camera = new PerspectiveCamera(38, 1, 0.05, 400);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.085;
    this.controls.rotateSpeed = 0.85;
    this.controls.zoomSpeed = 0.9;
    this.controls.panSpeed = 0.7;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // zeminin altına inme
    this.controls.autoRotate = options.autoRotate;
    this.controls.autoRotateSpeed = 0.9;
    this.controls.addEventListener('start', this.handleControlStart);

    this.scene.add(
      this.hemiLight,
      this.ambientLight,
      this.keyLight,
      this.keyLight.target,
      this.fillLight,
      this.fillLight.target,
      this.rimLight,
      this.rimLight.target
    );

    this.applyEnvironment();
    this.resize();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.renderer.setAnimationLoop(this.renderFrame);
  }

  setData(vehicle: VehicleVolume, boxes: readonly PlacedBox[], anchor: BoxAnchor): void {
    if (this.disposed) return;
    this.data = { vehicle, boxes: [...boxes], anchor };
    this.interacted = false;
    this.clearContent();
    this.buildContent();
    this.fitCamera();
  }

  setTheme(theme: SceneTheme): void {
    if (this.disposed || theme === this.theme) return;
    this.theme = theme;
    this.applyEnvironment();
    if (!this.data) return;
    this.rebuildKeepingCamera();
  }

  setShowHelpers(show: boolean): void {
    if (this.disposed || show === this.showHelpers) return;
    this.showHelpers = show;
    if (!this.data) return;
    this.rebuildKeepingCamera();
  }

  setShowLabels(show: boolean): void {
    if (this.disposed || show === this.showLabels) return;
    this.showLabels = show;
    if (!this.data) return;
    this.rebuildKeepingCamera();
  }

  setAutoRotate(enabled: boolean): void {
    if (this.disposed) return;
    this.controls.autoRotate = enabled;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.clearContent();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private readonly renderFrame = (): void => {
    this.controls.update();
    this.updateLabels();
    this.renderer.render(this.scene, this.camera);
  };

  /** packageId etiketlerini kameranın baktığı yüzeye taşır. */
  private updateLabels(): void {
    if (!this.labels.length || !this.frame) return;
    cameraLocal.copy(this.camera.position);
    this.frame.content.worldToLocal(cameraLocal);
    for (const label of this.labels) {
      label.update(cameraLocal);
    }
  }

  private readonly handleControlStart = (): void => {
    this.interacted = true;
  };

  private rebuildKeepingCamera(): void {
    const position = this.camera.position.clone();
    const target = this.controls.target.clone();
    this.clearContent();
    this.buildContent();
    this.camera.position.copy(position);
    this.controls.target.copy(target);
    this.controls.update();
  }

  private buildContent(): void {
    if (!this.data) return;
    const { vehicle, boxes, anchor } = this.data;

    const frame = createCargoFrame(vehicle);
    frame.content.add(buildCargoShell(vehicle, this.palette));
    frame.content.add(buildFloorGrid(vehicle, this.palette));
    boxes.forEach((box, index) => {
      const object = buildBoxObject(box, index, anchor, this.palette);
      if (this.showLabels) {
        const label = new BoxLabel(box, boxCenter(box, anchor), this.palette);
        object.add(label.mesh);
        this.labels.push(label);
      }
      frame.content.add(object);
    });
    if (this.showHelpers) {
      frame.content.add(buildAxisHelper());
      frame.content.add(buildFrontLabels(vehicle, this.palette));
    }

    this.scene.add(frame.root);
    this.frame = frame;
    this.scene.updateMatrixWorld(true);

    this.updateLights();
  }

  private updateLights(): void {
    if (!this.frame) return;
    const { center } = this.frame;
    const radius = this.sceneRadius();

    // Gölge yok: amaç her yüzün okunması. Üç yönlü ışık + yüksek ortam ışığı
    // yüzeyler arasındaki parlaklık farkını minimumda tutar.
    this.keyLight.position.set(
      center.x + radius * 0.8,
      center.y + radius * 1.6,
      center.z + radius * 0.9
    );
    this.keyLight.target.position.copy(center);
    this.keyLight.target.updateMatrixWorld();

    this.fillLight.position.set(
      center.x - radius * 1.1,
      center.y + radius * 0.8,
      center.z - radius * 1.0
    );
    this.fillLight.target.position.copy(center);
    this.fillLight.target.updateMatrixWorld();

    this.rimLight.position.set(
      center.x - radius * 0.6,
      center.y + radius * 0.5,
      center.z + radius * 1.4
    );
    this.rimLight.target.position.copy(center);
    this.rimLight.target.updateMatrixWorld();
  }

  private fitCamera(): void {
    if (!this.frame) return;
    const { size, center } = this.frame;
    const direction = new Vector3(1, 0.5, 1.15).normalize();

    const corners: Vector3[] = [];
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          corners.push(
            new Vector3((size.x / 2) * sx, (size.y / 2) * sy, (size.z / 2) * sz).add(center)
          );
        }
      }
    }

    // Perspektif projeksiyonu doğrusal olmadığı için mesafeyi birkaç iterasyonda sığdır.
    let distance = size.length() * 1.2;
    const projected = new Vector3();
    for (let iteration = 0; iteration < 3; iteration++) {
      this.camera.position.copy(center).addScaledVector(direction, distance);
      this.camera.lookAt(center);
      this.camera.updateMatrixWorld();
      let extent = 0;
      for (const corner of corners) {
        projected.copy(corner).project(this.camera);
        extent = Math.max(extent, Math.abs(projected.x), Math.abs(projected.y));
      }
      distance *= Math.max(extent, 0.01) / FIT_NDC;
    }

    this.camera.position.copy(center).addScaledVector(direction, distance);
    this.camera.near = Math.max(0.01, distance / 100);
    this.camera.far = distance * 14;
    this.camera.updateProjectionMatrix();

    this.controls.target.copy(center);
    this.controls.minDistance = distance * 0.25;
    this.controls.maxDistance = distance * 3.2;
    this.controls.update();
  }

  private applyEnvironment(): void {
    this.palette = paletteFor(this.theme);
    const isDark = this.theme === 'dark';

    this.background.setHex(this.palette.background);
    this.scene.background = this.background;

    // Gölge yok: aydınlatma "her yönden eşit" kurulur. Ortam ışığı taban,
    // üç yönlü düşük yoğunluklu directional sadece hafif form verir.
    this.hemiLight.color.setHex(this.palette.hemiSky);
    this.hemiLight.groundColor.setHex(this.palette.hemiGround);
    this.hemiLight.intensity = isDark ? 0.35 : 0.3;

    this.ambientLight.color.setHex(this.palette.ambient);
    this.ambientLight.intensity = isDark ? 1.6 : 1.5;

    this.keyLight.color.setHex(0xffffff);
    this.keyLight.intensity = isDark ? 0.5 : 0.45;

    this.fillLight.color.setHex(this.palette.hemiSky);
    this.fillLight.intensity = isDark ? 0.35 : 0.3;

    this.rimLight.color.setHex(this.palette.hemiSky);
    this.rimLight.intensity = isDark ? 0.3 : 0.25;
  }

  private clearContent(): void {
    this.labels.length = 0;
    if (this.frame) {
      this.scene.remove(this.frame.root);
      disposeObject3D(this.frame.root);
      this.frame = null;
    }
  }

  private sceneRadius(): number {
    if (!this.frame) return 1;
    const { size } = this.frame;
    return Math.max(size.x, size.y, size.z);
  }

  private resize(): void {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    // Kullanıcı kameraya dokunmadıysa yeni en/boy oranına göre yeniden sığdır.
    if (this.frame && !this.interacted) {
      this.fitCamera();
    }
  }
}
