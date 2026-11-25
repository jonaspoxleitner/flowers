import { conePolygons, parametricSurfacePolygons, spherePolygons } from "@glyphcss/core";
import type { Polygon } from "@glyphcss/core";
import type { Palette } from "../palette";
import { createRandom, randomRange } from "./random";
import type { Random } from "./random";
import { BASE_SHADE, RAMP_STEPS, shadeRamp } from "./shade";

const DEGREES = Math.PI / 180;
const PETAL_COLUMNS = 4;
const PETAL_ROWS = 3;
const PETAL_ROOT_SPAN = 0.55;
const AZIMUTH_JITTER = 3;
const CENTRE_RADIUS = 0.34;
const CENTRE_HEIGHT = 0.18;
const CENTRE_SIDES = 8;

export const ROSE_CORE_TONE = BASE_SHADE;
export const ROSE_CENTRE_TONE = BASE_SHADE + 2;
export const ROSE_CORE_RADIUS = 0.88;
export const ROSE_CORE_SUBDIVISIONS = 0;
const ROSE_CORE_FACES = 20 * 4 ** ROSE_CORE_SUBDIVISIONS;

export type RosePetal = {
  readonly azimuth: number;
  readonly root: number;
  readonly apex: number;
  readonly halfSpan: number;
  readonly scallop: number;
  readonly puff: number;
  readonly bulge: number;
  readonly tone: number;
};

export type RoseRing = Omit<RosePetal, "azimuth"> & { readonly petals: number };

export const ROSE_RINGS: readonly RoseRing[] = [
  {
    petals: 5,
    root: 172,
    apex: 96,
    halfSpan: 52,
    scallop: 22,
    puff: 0.03,
    bulge: 0.08,
    tone: BASE_SHADE,
  },
  {
    petals: 6,
    root: 124,
    apex: 60,
    halfSpan: 46,
    scallop: 18,
    puff: 0.05,
    bulge: 0.08,
    tone: BASE_SHADE,
  },
  {
    petals: 5,
    root: 82,
    apex: 26,
    halfSpan: 50,
    scallop: 14,
    puff: 0.07,
    bulge: 0.06,
    tone: BASE_SHADE - 1,
  },
];

// Petals are laid on a sphere in rings of shingles: `root`/`apex` are polar
// angles (degrees off the bloom axis) at a petal's base and free edge,
// `halfSpan` its angular half-width, `scallop` how far the free edge dips at
// its sides, and `puff` its stand-off from the core.
export const ROSE_PETALS: readonly RosePetal[] = ROSE_RINGS.flatMap((ring, ringIndex) =>
  Array.from({ length: ring.petals }, (_, index) => ({
    azimuth: (index / ring.petals) * 360 + ringIndex * 23,
    root: ring.root,
    apex: ring.apex,
    halfSpan: ring.halfSpan,
    scallop: ring.scallop,
    puff: ring.puff,
    bulge: ring.bulge,
    tone: ring.tone,
  })),
);

export const ROSE_PETAL_COUNT = ROSE_PETALS.length;

const PETAL_POLYGON_COUNT = (PETAL_COLUMNS - 1) * (PETAL_ROWS - 1) * 2;

export const ROSE_POLYGON_COUNT =
  ROSE_CORE_FACES + ROSE_PETAL_COUNT * PETAL_POLYGON_COUNT + CENTRE_SIDES + 1;

export type RoseOptions = {
  readonly palette: Palette;
  readonly color: string;
  readonly radius: number;
  readonly seed: number;
};

// Scenes render single-sided, so petal sheets must wind outward: the column
// order runs against the azimuth and no petal is ever mirrored.
function petalPolygons(
  petal: RosePetal,
  radius: number,
  colors: readonly string[],
  fallback: string,
): Polygon[] {
  const x: number[][] = [];
  const y: number[][] = [];
  const z: number[][] = [];
  const reach = radius * (1 + petal.puff);
  const root = petal.root * DEGREES;
  const free = (petal.apex + petal.scallop) * DEGREES;

  for (let row = 0; row < PETAL_ROWS; row += 1) {
    const along = row / (PETAL_ROWS - 1);
    const span = petal.halfSpan * DEGREES * (1 - (1 - PETAL_ROOT_SPAN) * along);
    x[row] = [];
    y[row] = [];
    z[row] = [];

    for (let column = 0; column < PETAL_COLUMNS; column += 1) {
      const across = 1 - (column / (PETAL_COLUMNS - 1)) * 2;
      const angle = petal.azimuth * DEGREES + across * span;
      const edge = free - petal.scallop * DEGREES * (1 - across * across);
      const polar = root + (edge - root) * along;
      const swell = reach * (1 + petal.bulge * (1 - across * across) * (0.3 + 0.7 * along));
      const horizontal = Math.sin(polar) * swell;

      x[row][column] = Math.cos(angle) * horizontal;
      y[row][column] = Math.cos(polar) * swell;
      z[row][column] = Math.sin(angle) * horizontal;
    }
  }

  return parametricSurfacePolygons({ x, y, z }, { color: (row) => colors[row] ?? fallback });
}

function corePolygons(radius: number, color: string): Polygon[] {
  return spherePolygons({
    center: [0, 0, 0],
    size: ROSE_CORE_RADIUS * radius,
    subdivisions: ROSE_CORE_SUBDIVISIONS,
    color,
  });
}

function centrePolygons(radius: number, color: string): Polygon[] {
  return conePolygons({
    center: [0, ROSE_CORE_RADIUS * radius, 0],
    radius: CENTRE_RADIUS * radius,
    height: CENTRE_HEIGHT * radius,
    sides: CENTRE_SIDES,
    color,
  });
}

function petalAzimuth(petal: RosePetal, random: Random): number {
  return petal.azimuth + randomRange(random, -AZIMUTH_JITTER, AZIMUTH_JITTER);
}

export function rosePolygons(options: RoseOptions): Polygon[] {
  const { color, radius, seed } = options;
  const random = createRandom(seed);
  const ramp = shadeRamp(color, RAMP_STEPS);
  const polygons = corePolygons(radius, ramp[ROSE_CORE_TONE] ?? color);

  for (const petal of ROSE_PETALS) {
    const azimuth = petalAzimuth(petal, random);
    const colors = [petal.tone, petal.tone, petal.tone + 1].map((tone) => ramp[tone] ?? color);
    polygons.push(...petalPolygons({ ...petal, azimuth }, radius, colors, color));
  }

  polygons.push(...centrePolygons(radius, ramp[ROSE_CENTRE_TONE] ?? color));

  return polygons;
}
