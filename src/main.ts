import "glyphcss/elements";
import { createGlyphOrbitControls, createGlyphPerspectiveCamera, createGlyphScene } from "glyphcss";
import type { GlyphOrbitControlsHandle, GlyphSceneHandle } from "glyphcss";
import type { Polygon, Vec3 } from "@glyphcss/core";
import { buildBouquet, buildBouquetParts } from "./bouquet";
import { createPaletteEditor } from "./controls";
import { renderLegend } from "./legend";
import { loadPalette, resetPalette, savePalette, STAGE_INK_DARK, STAGE_INK_LIGHT } from "./palette";
import type { Palette } from "./palette";
import "./style.css";

const SPIN_DEGREES_PER_FRAME = 0.2;
const FALLBACK_COLS = 120;
const FALLBACK_ROWS = 44;
const FALLBACK_FONT_SIZE = 13;
const FALLBACK_CELL_ASPECT = 2;
const FILL_FRACTION = 0.85;
const FIT_PASSES = 6;
const FIT_TOLERANCE = 0.03;
const INTERACTIVE_DOWNSCALE = 2;
const FRAME_SAMPLE_COUNT = 60;
const FRAME_BUDGET_MS = 33;
const QUALITY_FALLBACK_SCALE = 0.7;
const QUALITY_MIN_COLS = 48;
const QUALITY_MIN_ROWS = 24;
const LIGHT_ELEVATION_DEGREES = 32;
const LIGHT_AZIMUTH_OFFSET_DEGREES = -15;
const KEY_LIGHT_INTENSITY = 1;

type Extent = { readonly width: number; readonly height: number };

function keyLightDirection(cameraAzimuthDegrees: number): Vec3 {
  const azimuth = ((cameraAzimuthDegrees + LIGHT_AZIMUTH_OFFSET_DEGREES) * Math.PI) / 180;
  const elevation = (LIGHT_ELEVATION_DEGREES * Math.PI) / 180;
  const horizontal = Math.cos(elevation);

  return [horizontal * Math.cos(azimuth), horizontal * Math.sin(azimuth), Math.sin(elevation)];
}

type BouquetBounds = { readonly extent: Extent; readonly center: Vec3 };

type Occupied = Extent & {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
};

export type BouquetScene = {
  scene: GlyphSceneHandle;
  controls: GlyphOrbitControlsHandle;
  setPalette(palette: Palette): void;
  destroy(): void;
};

export type PageHosts = {
  scene: HTMLElement;
  legend: HTMLElement;
  controls: HTMLElement;
};

export type Page = { destroy(): void };

// Glyph space is Z-up: X and Y are the horizontal plane, Z is the vertical extent.
function bouquetBounds(polygons: Polygon[]): BouquetBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const polygon of polygons) {
    for (const [x, y, z] of polygon.vertices) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  }

  return {
    extent: {
      width: Math.max(maxX - minX, maxY - minY),
      height: maxZ - minZ,
    },
    center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
  };
}

function occupiedExtent(text: string): Occupied {
  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  let right = -Infinity;

  text.split("\n").forEach((line, row) => {
    Array.from(line).forEach((cell, col) => {
      if (cell === " ") return;
      top = Math.min(top, row);
      bottom = Math.max(bottom, row);
      left = Math.min(left, col);
      right = Math.max(right, col);
    });
  });

  if (top === Infinity) return { width: 0, height: 0, top: 0, bottom: 0, left: 0, right: 0 };
  return {
    width: right - left + 1,
    height: bottom - top + 1,
    top,
    bottom,
    left,
    right,
  };
}

// The rasterizer resolves `zoom` against its own cell metrics, so the projected span is
// measured and corrected.
function refineZoom(scene: GlyphSceneHandle): void {
  const options = scene.getOptions();
  const cols = options.cols ?? FALLBACK_COLS;
  const rows = options.rows ?? FALLBACK_ROWS;

  for (let pass = 0; pass < FIT_PASSES; pass += 1) {
    const occupied = occupiedExtent(scene.output.textContent ?? "");
    if (occupied.width === 0 || occupied.height === 0) return;

    // An asymmetric silhouette can sit off-centre even with a centred camera target.
    const offsetX = (occupied.left + occupied.right + 1) / 2 - cols / 2;
    const offsetY = (occupied.top + occupied.bottom + 1) / 2 - rows / 2;
    if (Math.abs(offsetX) > 1 || Math.abs(offsetY) > 1) {
      scene.camera.center = [0.5 - offsetX / cols, 0.5 - offsetY / rows];
      scene.rerender();
      continue;
    }

    // A silhouette touching the grid edge may be clipped, so only shrink it back into frame.
    const clipped =
      occupied.top <= 0 ||
      occupied.left <= 0 ||
      occupied.right >= cols - 1 ||
      occupied.bottom >= rows - 1;
    const factor = clipped
      ? FILL_FRACTION * Math.min(cols / occupied.width, rows / occupied.height)
      : Math.min((cols * FILL_FRACTION) / occupied.width, (rows * FILL_FRACTION) / occupied.height);
    if (Math.abs(factor - 1) <= FIT_TOLERANCE) return;

    scene.camera.zoom *= factor;
    scene.rerender();
  }
}

function frameCamera(scene: GlyphSceneHandle, bounds: BouquetBounds): void {
  const options = scene.getOptions();
  const fontSize = parseFloat(getComputedStyle(scene.output).fontSize) || FALLBACK_FONT_SIZE;
  const cellAspect = options.cellAspect || FALLBACK_CELL_ASPECT;
  const cellWidth = fontSize / cellAspect;
  const horizontal =
    ((options.cols ?? FALLBACK_COLS) * cellWidth * FILL_FRACTION) / bounds.extent.width;
  const vertical =
    ((options.rows ?? FALLBACK_ROWS) * fontSize * FILL_FRACTION) / bounds.extent.height;

  scene.camera.center = [0.5, 0.5];
  scene.camera.target = [bounds.center[0], bounds.center[1], bounds.center[2]];
  scene.camera.zoom = Math.min(horizontal, vertical);
  scene.rerender();
  refineZoom(scene);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

// Auto-spin never triggers interactiveDownscale, so a slow frame budget also drops the grid once.
export function guardFrameBudget(scene: GlyphSceneHandle, refit: () => void): () => void {
  if (typeof requestAnimationFrame !== "function") return () => {};

  let frames = 0;
  let elapsed = 0;
  let last = performance.now();
  let active = true;

  const tick = (now: number): void => {
    if (!active) return;
    elapsed += now - last;
    last = now;
    frames += 1;
    if (frames < FRAME_SAMPLE_COUNT) {
      requestAnimationFrame(tick);
      return;
    }

    active = false;
    if (elapsed / frames <= FRAME_BUDGET_MS) return;

    const resolution = scene.getBaseResolution();
    scene.setOptions({
      autoSize: false,
      cols: Math.max(QUALITY_MIN_COLS, Math.round(resolution.cols * QUALITY_FALLBACK_SCALE)),
      rows: Math.max(QUALITY_MIN_ROWS, Math.round(resolution.rows * QUALITY_FALLBACK_SCALE)),
    });
    refit();
  };

  const handle = requestAnimationFrame(tick);

  return () => {
    active = false;
    cancelAnimationFrame(handle);
  };
}

export function mountScene(host: HTMLElement, polygons: Polygon[]): BouquetScene {
  const camera = createGlyphPerspectiveCamera({ rotX: 58, rotY: 45, zoom: 140 });
  const scene = createGlyphScene(host, {
    cols: FALLBACK_COLS,
    rows: FALLBACK_ROWS,
    mode: "solid",
    charMode: "quadrant",
    autoSize: true,
    interactiveDownscale: INTERACTIVE_DOWNSCALE,
    camera,
  });
  const mesh = scene.add(polygons);
  const bounds = bouquetBounds(polygons);

  const refit = (): void => {
    scene.fit();
    frameCamera(scene, bounds);
  };

  refit();

  const controls = createGlyphOrbitControls(scene, {
    animate: prefersReducedMotion()
      ? false
      : { axis: "y", speed: SPIN_DEGREES_PER_FRAME, pauseOnInteraction: true },
  });

  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(refit);
  observer?.observe(host);
  const settle = typeof requestAnimationFrame === "function" ? requestAnimationFrame(refit) : null;
  const stopGuard = guardFrameBudget(scene, refit);

  const followView = (): void => {
    scene.setOptions({
      directionalLight: {
        direction: keyLightDirection(camera.rotY),
        intensity: KEY_LIGHT_INTENSITY,
      },
    });
  };

  controls.addEventListener("change", followView);
  followView();

  return {
    scene,
    controls,
    setPalette(next: Palette) {
      mesh.setPolygons(buildBouquet(next));
      scene.rerender();
    },
    destroy() {
      stopGuard();
      if (settle !== null) cancelAnimationFrame(settle);
      controls.removeEventListener("change", followView);
      observer?.disconnect();
      controls.destroy();
      scene.destroy();
    },
  };
}

function readableInk(background: string): string {
  const red = parseInt(background.slice(1, 3), 16);
  const green = parseInt(background.slice(3, 5), 16);
  const blue = parseInt(background.slice(5, 7), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.55 ? STAGE_INK_DARK : STAGE_INK_LIGHT;
}

function applyBackdrop(palette: Palette): void {
  const root = document.documentElement;
  root.style.setProperty("--stage-backdrop", palette.backdrop);
  root.style.setProperty("--stage-ink", readableInk(palette.backdrop));
}

export function mountPage(hosts: PageHosts): Page {
  let palette = loadPalette();
  const parts = buildBouquetParts(palette);

  applyBackdrop(palette);
  const view = mountScene(hosts.scene, parts.polygons);
  renderLegend(hosts.legend, palette, parts.inventory);

  const editor = createPaletteEditor(hosts.controls, palette, {
    onChange(role, value) {
      update({ ...palette, [role]: value });
    },
    onReset() {
      update(resetPalette(), false);
    },
  });

  function update(next: Palette, persist = true): void {
    palette = next;
    applyBackdrop(next);
    view.setPalette(next);
    renderLegend(hosts.legend, next, parts.inventory);
    editor.render(next);
    if (persist) savePalette(next);
  }

  const rerenderChrome = (): void => {
    renderLegend(hosts.legend, palette, parts.inventory);
    editor.render(palette);
  };

  window.addEventListener("resize", rerenderChrome);

  return {
    destroy() {
      window.removeEventListener("resize", rerenderChrome);
      view.destroy();
    },
  };
}

const sceneHost = document.querySelector<HTMLElement>("#scene-host");
const legendHost = document.querySelector<HTMLElement>("#legend-host");
const controlsHost = document.querySelector<HTMLElement>("#controls-host");

if (sceneHost && legendHost && controlsHost) {
  mountPage({ scene: sceneHost, legend: legendHost, controls: controlsHost });
}
