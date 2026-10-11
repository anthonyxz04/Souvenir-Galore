/**
 * Draws the candle with three.js. Loaded only in the browser, on demand (the
 * product page imports this module dynamically), so pages without a 3D
 * preview never download three.js.
 *
 * Everything is built from code (no model files): the jar is a lathe profile,
 * the concrete, wood and label are canvas textures, and the flame is a few
 * glowing shapes with a warm point light.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { CandleLook, CandleShape, LabelFont, LidStyle } from "./config";

export type SceneFonts = Record<LabelFont, string>;

export type CandleScene = {
  update(look: CandleLook): void;
  resetView(): void;
  dispose(): void;
};

type Options = {
  fonts: SceneFonts;
  reducedMotion: boolean;
  /** Small previews (admin editor) skip auto-rotation and use fewer pixels. */
  compact?: boolean;
  onInteract?: () => void;
};

// ─────────────────────────────────────────────────────────────
// Shapes (units are roughly centimetres)
// ─────────────────────────────────────────────────────────────

type ShapeSpec = {
  height: number;
  /** Outer radius at height y. */
  radius: (y: number) => number;
  wall: number;
  base: number;
  waxTop: number;
  label: { center: number; height: number; arc: number };
  jar: boolean;
};

const SHAPES: Record<CandleShape, ShapeSpec> = {
  tumbler: { height: 9, radius: () => 3.9, wall: 0.45, base: 0.7, waxTop: 7.4, label: { center: 4.1, height: 3.5, arc: 2.6 }, jar: true },
  tapered: { height: 8.6, radius: (y) => 3.25 + (y / 8.6) * 0.95, wall: 0.45, base: 0.7, waxTop: 7.1, label: { center: 4.0, height: 3.2, arc: 2.6 }, jar: true },
  bowl: {
    height: 4.8,
    radius: (y) => 3.3 + 2.3 * Math.sin((Math.PI / 2) * Math.min(1, y / 3.6)),
    wall: 0.5,
    base: 0.7,
    waxTop: 3.9,
    label: { center: 2.3, height: 1.9, arc: 2.2 },
    jar: true,
  },
  pillar: { height: 9.4, radius: () => 3.2, wall: 0, base: 0, waxTop: 9.4, label: { center: 4.6, height: 3.8, arc: 2.6 }, jar: false },
};

/** The camera frames this size, so smaller and larger options look smaller and larger. */
const FRAME_SCALE = 1.25;

function jarProfile(spec: ShapeSpec): THREE.Vector2[] {
  const points: THREE.Vector2[] = [];
  const bevel = 0.35;
  const r0 = spec.radius(0);
  points.push(new THREE.Vector2(0, 0));
  points.push(new THREE.Vector2(r0 - bevel, 0));
  for (let i = 1; i <= 6; i += 1) {
    const a = (i / 6) * (Math.PI / 2);
    points.push(new THREE.Vector2(r0 - bevel + Math.sin(a) * bevel, bevel - Math.cos(a) * bevel));
  }
  const steps = 24;
  for (let i = 1; i <= steps; i += 1) {
    const y = bevel + ((spec.height - bevel) * i) / steps;
    points.push(new THREE.Vector2(spec.radius(y), y));
  }
  // Rounded rim
  const rTop = spec.radius(spec.height);
  for (let i = 1; i <= 6; i += 1) {
    const a = (i / 6) * Math.PI;
    points.push(new THREE.Vector2(rTop - spec.wall / 2 + (Math.cos(a) * spec.wall) / 2, spec.height + Math.sin(a) * 0.12));
  }
  for (let i = steps; i >= 0; i -= 1) {
    const y = spec.base + ((spec.height - spec.base) * i) / steps;
    points.push(new THREE.Vector2(Math.max(0.01, spec.radius(y) - spec.wall), y));
  }
  points.push(new THREE.Vector2(0, spec.base));
  return points;
}

function waxProfile(spec: ShapeSpec): THREE.Vector2[] {
  const top = spec.waxTop;
  const r = spec.jar ? spec.radius(top) - spec.wall - 0.01 : spec.radius(top);
  const bottom = spec.jar ? spec.base + 0.01 : 0;
  const rb = spec.jar ? spec.radius(bottom) - spec.wall - 0.01 : spec.radius(0);
  const dip = spec.jar ? 0.18 : 0.35;
  const points = [new THREE.Vector2(0, top - dip), new THREE.Vector2(r * 0.55, top - dip * 0.75), new THREE.Vector2(r * 0.85, top - dip * 0.3)];
  if (!spec.jar) {
    // Pillar: soft rounded shoulder and bottom edge.
    for (let i = 0; i <= 5; i += 1) {
      const a = (i / 5) * (Math.PI / 2);
      points.push(new THREE.Vector2(r - 0.3 + Math.sin(a) * 0.3, top - 0.3 + Math.cos(a) * 0.3));
    }
    points.push(new THREE.Vector2(rb, 0.2), new THREE.Vector2(rb - 0.2, 0), new THREE.Vector2(0, 0));
  } else {
    points.push(new THREE.Vector2(r, top), new THREE.Vector2(rb, bottom), new THREE.Vector2(0, bottom));
  }
  // Lathe faces point outward when the profile runs from the bottom up.
  return points.reverse();
}

function maxRadius(spec: ShapeSpec): number {
  let max = 0;
  for (let i = 0; i <= 20; i += 1) max = Math.max(max, spec.radius((spec.height * i) / 20));
  return max;
}

/** The label follows the outside of the jar between two heights. */
function labelProfile(spec: ShapeSpec): THREE.Vector2[] {
  const { center, height } = spec.label;
  const offset = spec.jar ? 0.02 : 0.015;
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i += 1) {
    const y = center - height / 2 + (height * i) / 16;
    points.push(new THREE.Vector2(spec.radius(y) + offset, y));
  }
  return points;
}

// ─────────────────────────────────────────────────────────────
// Canvas textures
// ─────────────────────────────────────────────────────────────

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  return [c, ctx];
}

/** Light, speckled concrete: multiplies the chosen jar color. */
function concreteTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 512);
  ctx.fillStyle = "rgb(236,236,236)";
  ctx.fillRect(0, 0, 512, 512);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 9000; i += 1) {
    const v = 205 + Math.floor(rand() * 50);
    ctx.fillStyle = `rgba(${v},${v},${v},${0.35 + rand() * 0.4})`;
    ctx.fillRect(rand() * 512, rand() * 512, 1 + rand() * 2, 1 + rand() * 2);
  }
  for (let i = 0; i < 140; i += 1) {
    ctx.fillStyle = `rgba(120,120,120,${0.25 + rand() * 0.35})`;
    ctx.beginPath();
    ctx.arc(rand() * 512, rand() * 512, 0.6 + rand() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function woodTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 512);
  ctx.fillStyle = "#b38b62";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 70; i += 1) {
    ctx.strokeStyle = `rgba(${90 + (i % 5) * 8},${62 + (i % 4) * 6},${40},${0.18 + (i % 3) * 0.08})`;
    ctx.lineWidth = 1 + (i % 4);
    ctx.beginPath();
    ctx.arc(256, 256, 8 + i * 3.6 + Math.sin(i) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function radialTexture(stops: [number, string][], size = 256): THREE.CanvasTexture {
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function drawLabel(ctx: CanvasRenderingContext2D, width: number, height: number, look: CandleLook, fonts: SceneFonts) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = look.labelColor;
  ctx.fillRect(0, 0, width, height);
  // Thin inset border, like a printed paper label.
  ctx.strokeStyle = look.textColor;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 3;
  const inset = height * 0.07;
  ctx.strokeRect(width * 0.16, inset, width * 0.68, height - inset * 2);
  ctx.globalAlpha = 1;

  ctx.fillStyle = look.textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${Math.round(height * 0.085)}px ${fonts.sans}`;
  ctx.globalAlpha = 0.7;
  ctx.fillText("Souvenir Galore", width / 2, height * 0.2);
  ctx.globalAlpha = 1;

  const lines = look.lines;
  if (!lines.length) return;
  const maxWidth = width * 0.56;
  const area = height * 0.6;
  const family = fonts[look.font];
  const weight = look.font === "sans" ? 500 : 400;
  let size = Math.min(area / (lines.length * 1.15), height * (look.font === "script" ? 0.34 : 0.27));
  ctx.font = `${weight} ${Math.round(size)}px ${family}`;
  const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
  if (widest > maxWidth) size *= maxWidth / widest;
  ctx.font = `${weight} ${Math.round(size)}px ${family}`;
  ctx.globalAlpha = look.placeholder ? 0.4 : 1;
  const lineHeight = size * 1.12;
  const top = height * 0.58 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, width / 2, top + i * lineHeight));
  ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────────────────────────
// Scene
// ─────────────────────────────────────────────────────────────

export function createCandleScene(target: HTMLCanvasElement, initial: CandleLook, options: Options): CandleScene {
  const renderer = new THREE.WebGLRenderer({ canvas: target, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.compact ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
  const controls = new OrbitControls(camera, target);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minPolarAngle = 0.45;
  controls.maxPolarAngle = 1.52;
  controls.rotateSpeed = 0.8;
  controls.autoRotate = !options.reducedMotion && !options.compact;
  controls.autoRotateSpeed = 0.9;
  // No wheel or pinch zoom (the page keeps scrolling normally), and on touch
  // screens an up/down swipe scrolls the page while a sideways swipe turns the candle.
  controls.enableZoom = false;
  target.style.touchAction = "pan-y";

  // Lights: soft room light, a warm key from the front left, and the flame.
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0xb6a68e, 1.1));
  const key = new THREE.DirectionalLight(0xfff1de, 1.6);
  key.position.set(-8, 14, 12);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.position.set(9, 8, -10);
  scene.add(rim);

  const disposables: { dispose(): void }[] = [environment, pmrem];
  const track = <T extends { dispose(): void }>(item: T) => {
    disposables.push(item);
    return item;
  };

  const concrete = track(concreteTexture());
  const wood = track(woodTexture());
  const shadowTexture = track(radialTexture([[0, "rgba(40,30,20,0.42)"], [0.55, "rgba(40,30,20,0.16)"], [1, "rgba(40,30,20,0)"]]));
  const glowTexture = track(radialTexture([[0, "rgba(255,214,150,0.9)"], [0.25, "rgba(255,170,90,0.35)"], [1, "rgba(255,150,60,0)"]]));

  const jarMaterial = track(new THREE.MeshStandardMaterial({ map: concrete, bumpMap: concrete, bumpScale: 0.6, roughness: 0.93, metalness: 0 }));
  const waxMaterial = track(new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, emissive: new THREE.Color(0xff9a4a), emissiveIntensity: 0.06 }));
  const wickMaterial = track(new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.9 }));
  const shadowMaterial = track(new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));

  const [labelCanvas, labelCtx] = canvas(1536, 512);
  const labelTexture = track(new THREE.CanvasTexture(labelCanvas));
  labelTexture.colorSpace = THREE.SRGBColorSpace;
  labelTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const labelMaterial = track(new THREE.MeshStandardMaterial({ map: labelTexture, roughness: 0.82, metalness: 0, side: THREE.FrontSide }));

  const candle = new THREE.Group();
  scene.add(candle);
  const shadow = new THREE.Mesh(track(new THREE.CircleGeometry(1, 48)), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  scene.add(shadow);

  // Flame
  const flame = new THREE.Group();
  const flamePoints: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i += 1) {
    const t = i / 16;
    flamePoints.push(new THREE.Vector2(Math.max(0.001, 0.26 * Math.sin(Math.PI * Math.pow(t, 0.62)) * (1 - t * 0.15)), t * 1.25));
  }
  const outerFlame = new THREE.Mesh(
    track(new THREE.LatheGeometry(flamePoints, 24)),
    track(new THREE.MeshBasicMaterial({ color: 0xffb54d, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })),
  );
  const innerFlame = new THREE.Mesh(
    track(new THREE.LatheGeometry(flamePoints.map((p) => new THREE.Vector2(p.x * 0.55, p.y * 0.7)), 20)),
    track(new THREE.MeshBasicMaterial({ color: 0xfff3d1, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })),
  );
  innerFlame.position.y = 0.04;
  const glow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glowTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  glow.scale.set(3.2, 3.2, 1);
  glow.position.y = 0.55;
  const flameLight = new THREE.PointLight(0xffa452, 9, 16, 2);
  flameLight.position.y = 0.7;
  flame.add(outerFlame, innerFlame, glow, flameLight);

  let parts: THREE.Object3D[] = [];
  let currentShape: CandleShape | null = null;
  let spec = SHAPES[initial.shape];
  let look = initial;
  let lid: THREE.Mesh | null = null;
  let lidStyle: LidStyle | null = null;
  const lidMaterials = new Map<LidStyle, THREE.Material>();

  function lidMaterial(style: LidStyle): THREE.Material {
    let material = lidMaterials.get(style);
    if (!material) {
      material =
        style === "wood"
          ? new THREE.MeshStandardMaterial({ map: wood, roughness: 0.68 })
          : style === "gold"
            ? new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 1, roughness: 0.3 })
            : style === "black"
              ? new THREE.MeshStandardMaterial({ color: 0x2b2a28, roughness: 0.85 })
              : new THREE.MeshStandardMaterial({ map: concrete, color: 0xa9a49b, roughness: 0.93 });
      lidMaterials.set(style, track(material));
    }
    return material;
  }

  function buildShape(shape: CandleShape) {
    for (const part of parts) {
      candle.remove(part);
      if (part instanceof THREE.Mesh) part.geometry.dispose();
    }
    parts = [];
    spec = SHAPES[shape];
    if (spec.jar) {
      const jar = new THREE.Mesh(new THREE.LatheGeometry(jarProfile(spec), 96), jarMaterial);
      parts.push(jar);
    }
    parts.push(new THREE.Mesh(new THREE.LatheGeometry(waxProfile(spec), 96), waxMaterial));

    // Wick with a slight lean, then the flame on top of it.
    const wickTop = spec.waxTop - (spec.jar ? 0.18 : 0.35) + 0.75;
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 8), wickMaterial);
    wick.position.y = wickTop - 0.4;
    wick.rotation.z = 0.08;
    parts.push(wick);
    flame.position.set(-0.03, wickTop - 0.02, 0);

    // The label wraps the front of the jar (or the pillar itself).
    const arc = spec.label.arc;
    const label = new THREE.Mesh(new THREE.LatheGeometry(labelProfile(spec), 64, -arc / 2, arc), labelMaterial);
    label.name = "label";
    parts.push(label);

    for (const part of parts) candle.add(part);
    candle.add(flame);
    currentShape = shape;
  }

  function placeLid(style: LidStyle) {
    if (lid) {
      scene.remove(lid);
      lid.geometry.dispose();
      lid = null;
    }
    lidStyle = style;
    if (style === "none" || !spec.jar) return;
    const r = spec.radius(spec.height) + 0.12;
    const geometry = new THREE.CylinderGeometry(r, r, 0.55, 72);
    lid = new THREE.Mesh(geometry, lidMaterial(style));
    lid.name = "lid";
    // Resting on the table beside the jar, slightly propped against it.
    scene.add(lid);
  }

  function layout() {
    const s = look.scale;
    candle.scale.setScalar(s);
    const footprint = maxRadius(spec) * s;
    shadow.scale.setScalar(footprint * 1.75);
    if (lid) {
      const r = (spec.radius(spec.height) + 0.12) * s;
      lid.scale.setScalar(s);
      // Lying on the table, set aside behind and to the right of the jar.
      lid.position.set(footprint * 0.55 + r * 0.55, 0.275 * s, -footprint * 0.95);
      lid.rotation.set(0, 0.3, 0);
    }
  }

  const fontsReady = new Set<string>();
  function paintLabel() {
    const label = candle.getObjectByName("label");
    if (label) label.visible = look.showLabel;
    if (!look.showLabel) return;
    drawLabel(labelCtx, labelCanvas.width, labelCanvas.height, look, options.fonts);
    labelTexture.needsUpdate = true;
    // Web fonts load lazily: repaint once the chosen one is ready.
    const family = options.fonts[look.font];
    if (!fontsReady.has(family) && document.fonts) {
      fontsReady.add(family);
      document.fonts
        .load(`64px ${family}`)
        .then(() => {
          if (disposed) return;
          drawLabel(labelCtx, labelCanvas.width, labelCanvas.height, look, options.fonts);
          labelTexture.needsUpdate = true;
          requestRender();
        })
        .catch(() => undefined);
    }
  }

  function frame() {
    const baseHeight = Math.max(spec.height, maxRadius(spec) * 1.3) * FRAME_SCALE;
    const targetY = (spec.height * Math.max(look.scale, 0.9)) / 2.3;
    controls.target.set(lid ? maxRadius(spec) * look.scale * 0.3 : 0, targetY, 0);
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    const sizeScale = Math.max(1, look.scale / FRAME_SCALE);
    const byHeight = (baseHeight * sizeScale) / (2 * tanHalf);
    // Wide shapes (a bowl, or a jar with its lid beside it) must fit across too.
    const halfWidth = maxRadius(spec) * (lid ? 1.9 : 1.2) * Math.max(look.scale, 1);
    const byWidth = halfWidth / (tanHalf * Math.max(0.5, camera.aspect));
    const distance = Math.max(byHeight * 1.25 + 10, byWidth * 1.1 + 6);
    const direction = new THREE.Vector3(0.0, 0.5, 1).normalize();
    camera.position.copy(controls.target).addScaledVector(direction, distance);
    controls.minDistance = distance * 0.6;
    controls.maxDistance = distance * 1.5;
    camera.updateProjectionMatrix();
    controls.update();
  }

  function apply(next: CandleLook, reframe = false) {
    const previousScale = look.scale;
    look = next;
    if (next.shape !== currentShape) {
      buildShape(next.shape);
      reframe = true;
    }
    jarMaterial.color.set(next.jarColor);
    waxMaterial.color.set(next.waxColor);
    if (next.lid !== lidStyle || reframe) {
      const hadLid = Boolean(lid);
      placeLid(next.lid);
      if (hadLid !== Boolean(lid)) reframe = true;
    }
    layout();
    paintLabel();
    if (reframe || Math.abs(previousScale - next.scale) > 0.001) frame();
    requestRender();
  }

  // ── Sizing and rendering ─────────────────────────────────
  function resize() {
    const width = target.clientWidth || 1;
    const height = target.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (currentShape) frame();
    requestRender();
  }

  let disposed = false;
  let visible = true;
  let animating = !options.reducedMotion;
  let frameRequest = 0;
  const clock = new THREE.Clock();

  function render() {
    frameRequest = 0;
    if (disposed) return;
    const t = clock.getElapsedTime();
    if (animating) {
      const flicker = 1 + Math.sin(t * 9.1) * 0.035 + Math.sin(t * 23.7) * 0.025 + Math.sin(t * 3.3) * 0.04;
      outerFlame.scale.set(1 + (flicker - 1) * 0.5, flicker, 1 + (flicker - 1) * 0.5);
      innerFlame.scale.setScalar(0.96 + (flicker - 1) * 0.6);
      flame.rotation.z = Math.sin(t * 1.7) * 0.04;
      flameLight.intensity = 9 * (0.92 + (flicker - 1) * 2.2);
      glow.material.opacity = 0.85 + (flicker - 1) * 1.5;
    }
    controls.update();
    renderer.render(scene, camera);
    if (animating && visible) frameRequest = requestAnimationFrame(render);
  }

  function requestRender() {
    if (!frameRequest && !disposed) frameRequest = requestAnimationFrame(render);
  }

  const onControlsChange = () => {
    if (!animating) requestRender();
  };
  const onStart = () => {
    controls.autoRotate = false;
    options.onInteract?.();
  };
  controls.addEventListener("change", onControlsChange);
  controls.addEventListener("start", onStart);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(target);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) requestRender();
  });
  intersection.observe(target);
  const onVisibility = () => {
    visible = document.visibilityState === "visible";
    if (visible) requestRender();
  };
  document.addEventListener("visibilitychange", onVisibility);

  buildShape(initial.shape);
  apply(initial, true);
  resize();

  return {
    update(next) {
      apply(next);
    },
    resetView() {
      controls.autoRotate = !options.reducedMotion && !options.compact;
      frame();
      requestRender();
    },
    dispose() {
      disposed = true;
      animating = false;
      if (frameRequest) cancelAnimationFrame(frameRequest);
      controls.removeEventListener("change", onControlsChange);
      controls.removeEventListener("start", onStart);
      controls.dispose();
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      if (lid) lid.geometry.dispose();
      for (const item of disposables) item.dispose();
      renderer.dispose();
    },
  };
}
