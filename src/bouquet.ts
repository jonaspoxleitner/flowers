import { conePolygons, cylinderPolygons } from "@glyphcss/core";
import type { Polygon, Vec3 } from "@glyphcss/core";
import type { Palette, PaletteRole } from "./palette";
import { bodyPolygons } from "./flowers/body";
import { eucalyptusPolygons } from "./flowers/eucalyptus";
import { createRandom, randomRange } from "./flowers/random";
import type { Random } from "./flowers/random";
import { rosePolygons } from "./flowers/rose";
import { BASE_SHADE, RAMP_STEPS, shadeRamp } from "./flowers/shade";

const BOUQUET_SEED = 20240517;
const GOLDEN_ANGLE_DEGREES = 137.508;
const DEGREES = Math.PI / 180;
const HEAD_RADIUS = 1.2;
const HEAD_BASE_Y = 0.66;
const HEAD_DOME = 0.48;
const HEAD_SPREAD = 1.0;
export const TIE_RADIUS = 0.3;
const RIBBON_CINCH = 0.95;
const RIBBON_SIDES = 16;
const RIBBON_BAND_HALF_HEIGHT = 0.045;
const RIBBON_BAND_TILT = 0.1;
const RIBBON_DROP = 0.02;
const SPRIG_SEGMENTS = 4;
const SPRIG_BUD_SIDES = 6;
const SPRIG_BUD_RADIUS = 0.24;
const SPRIG_SPIKE_START = 0.1;

export type BouquetRole = Exclude<PaletteRole, "backdrop">;

export type BouquetInventory = Record<BouquetRole, number>;

export type BouquetParts = {
  polygons: Polygon[];
  inventory: BouquetInventory;
};

export const POLYGON_BUDGET = { min: 2000, max: 3400 } as const;

type Placement = {
  readonly center: Vec3;
  readonly azimuth: number;
  readonly lean: number;
};

type FoliageTier = {
  readonly anchorRadius: number;
  readonly anchorY: number;
  readonly leafScale: number;
  readonly length: number;
  readonly lean: readonly [number, number];
};

const FOLIAGE_TIERS: readonly FoliageTier[] = [
  {
    anchorRadius: HEAD_RADIUS * 0.95,
    anchorY: HEAD_BASE_Y + 0.29,
    leafScale: HEAD_RADIUS * 0.3,
    length: 0.95,
    lean: [-40, -30],
  },
  {
    anchorRadius: HEAD_RADIUS * 0.5,
    anchorY: HEAD_BASE_Y - 0.3,
    leafScale: HEAD_RADIUS * 0.27,
    length: 0.7,
    lean: [-38, -28],
  },
];

const STEM_ORIGIN_Y = HEAD_BASE_Y - 0.05;
const STEM_ORIGIN_PULL = 0.75;

function polar(angleDegrees: number, distance: number): [number, number] {
  const angle = angleDegrees * DEGREES;
  return [Math.cos(angle) * distance, Math.sin(angle) * distance];
}

// glyphcss is Z-up; the bouquet is composed in a Y-up frame where cylinders and discs are axial.
function toGlyphSpace(polygons: Polygon[]): Polygon[] {
  return polygons.map((polygon) => ({
    ...polygon,
    vertices: polygon.vertices.map(([x, y, z]): Vec3 => [x, -z, y]),
  }));
}

function placeParts(polygons: Polygon[], placement: Placement): Polygon[] {
  const cosAzimuth = Math.cos(placement.azimuth);
  const sinAzimuth = Math.sin(placement.azimuth);
  const cosLean = Math.cos(placement.lean * DEGREES);
  const sinLean = Math.sin(placement.lean * DEGREES);
  const [centerX, centerY, centerZ] = placement.center;

  return polygons.map((polygon) => ({
    ...polygon,
    vertices: polygon.vertices.map(([x, y, z]): Vec3 => {
      const leanedX = x * cosLean + y * sinLean;
      const leanedY = y * cosLean - x * sinLean;
      return [
        leanedX * cosAzimuth - z * sinAzimuth + centerX,
        leanedY + centerY,
        leanedX * sinAzimuth + z * cosAzimuth + centerZ,
      ];
    }),
  }));
}

function roseHead(
  palette: Palette,
  random: Random,
  inventory: BouquetInventory,
): { polygons: Polygon[]; anchors: Vec3[] } {
  const creamCount = 4 + Math.floor(random() * 3);
  const lavenderCount = 3 + Math.floor(random() * 2);
  const total = creamCount + lavenderCount;
  const polygons: Polygon[] = [];
  const anchors: Vec3[] = [];

  inventory.creamRose = creamCount;
  inventory.lavenderRose = lavenderCount;

  const roles = [
    ...Array.from({ length: creamCount }, () => true),
    ...Array.from({ length: lavenderCount }, () => false),
  ];
  for (let index = roles.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [roles[index], roles[swap]] = [roles[swap], roles[index]];
  }

  for (let index = 0; index < total; index += 1) {
    const cream = roles[index];
    const color = cream ? palette.creamRose : palette.lavenderRose;
    const distance = HEAD_RADIUS * Math.sqrt((index + 0.5) / total) * HEAD_SPREAD;
    const angle = index * GOLDEN_ANGLE_DEGREES + randomRange(random, -8, 8);
    const [x, z] = polar(angle, distance);
    const dome = Math.sqrt(Math.max(0, 1 - (distance / HEAD_RADIUS) ** 2));
    const center: Vec3 = [x, HEAD_BASE_Y + dome * HEAD_DOME, z];
    const radius =
      HEAD_RADIUS * (cream ? randomRange(random, 0.3, 0.35) : randomRange(random, 0.27, 0.32));
    const bloom = rosePolygons({
      palette,
      color,
      radius,
      seed: Math.floor(random() * 4294967296),
    });

    polygons.push(
      ...placeParts(bloom, {
        center,
        azimuth: angle * DEGREES + randomRange(random, -0.4, 0.4),
        lean: 10 + 38 * (distance / HEAD_RADIUS) + randomRange(random, -4, 4),
      }),
    );
    anchors.push(center);
  }

  return { polygons, anchors };
}

function foliage(
  palette: Palette,
  random: Random,
  inventory: BouquetInventory,
): { polygons: Polygon[]; anchors: Vec3[] } {
  const count = 6 + Math.floor(random() * 3);
  const polygons: Polygon[] = [];
  const anchors: Vec3[] = [];

  inventory.eucalyptus = count;

  for (let index = 0; index < count; index += 1) {
    const tier = FOLIAGE_TIERS[index % FOLIAGE_TIERS.length];
    const angle = (index / count) * 360 + randomRange(random, -12, 12);
    const [x, z] = polar(angle, tier.anchorRadius + randomRange(random, -0.04, 0.04));
    const anchor: Vec3 = [x, tier.anchorY + randomRange(random, -0.05, 0.05), z];
    const sprig = eucalyptusPolygons({
      palette,
      color: palette.eucalyptus,
      radius: tier.leafScale * randomRange(random, 0.92, 1.08),
      length: tier.length * randomRange(random, 0.92, 1.08),
      seed: Math.floor(random() * 4294967296),
    });

    polygons.push(
      ...placeParts(sprig, {
        center: anchor,
        azimuth: angle * DEGREES + randomRange(random, -0.16, 0.16),
        lean: randomRange(random, tier.lean[0], tier.lean[1]),
      }),
    );
    anchors.push(anchor);
  }

  return { polygons, anchors };
}

function sprigPolygons(color: string, length: number): Polygon[] {
  const ramp = shadeRamp(color, RAMP_STEPS);
  const spikeStart = length * SPRIG_SPIKE_START;
  const polygons = cylinderPolygons({
    center: [0, length / 2, 0],
    radius: 0.024,
    height: length,
    sides: 5,
    color: ramp[BASE_SHADE - 1] ?? color,
  });
  const segmentHeight = (length - spikeStart) / SPRIG_SEGMENTS;

  for (let index = 0; index < SPRIG_SEGMENTS; index += 1) {
    const along = (index + 0.5) / SPRIG_SEGMENTS;
    polygons.push(
      ...conePolygons({
        center: [0, spikeStart + segmentHeight * (index + 0.5), 0],
        radius: SPRIG_BUD_RADIUS * (1 - 0.9 * along),
        height: segmentHeight,
        sides: SPRIG_BUD_SIDES,
        color: ramp[BASE_SHADE - 1 + (index % 2)] ?? color,
      }),
    );
  }

  return polygons;
}

function lavenderSprigs(palette: Palette, random: Random, inventory: BouquetInventory): Polygon[] {
  const count = 5 + Math.floor(random() * 3);
  const polygons: Polygon[] = [];

  inventory.lavenderSprig = count;

  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * 360 + randomRange(random, -18, 18);
    const distance = HEAD_RADIUS * randomRange(random, 0.32, 0.68);
    const [x, z] = polar(angle, distance);
    const dome = Math.sqrt(Math.max(0, 1 - (distance / HEAD_RADIUS) ** 2));
    const baseY = HEAD_BASE_Y + dome * HEAD_DOME * 0.7 + 0.04;
    const length = randomRange(random, 0.92, 1.14);
    const sprig = sprigPolygons(palette.lavenderSprig, length);

    polygons.push(
      ...placeParts(sprig, {
        center: [x, baseY, z],
        azimuth: angle * DEGREES + randomRange(random, -0.2, 0.2),
        lean: randomRange(random, 26, 42),
      }),
    );
  }

  return polygons;
}

function ribbonBand(
  center: Vec3,
  radius: number,
  halfHeight: number,
  tilt: number,
  phase: number,
  color: string,
): Polygon[] {
  const ringPoint = (index: number, offset: number): Vec3 => {
    const angle = (index / RIBBON_SIDES) * Math.PI * 2;
    return [
      Math.cos(angle) * radius + center[0],
      center[1] + offset + tilt * Math.cos(angle - phase),
      Math.sin(angle) * radius + center[2],
    ];
  };
  const polygons: Polygon[] = [];

  for (let index = 0; index < RIBBON_SIDES; index += 1) {
    polygons.push({
      vertices: [
        ringPoint(index, halfHeight),
        ringPoint(index + 1, halfHeight),
        ringPoint(index + 1, -halfHeight),
        ringPoint(index, -halfHeight),
      ],
      color,
    });
  }

  return polygons;
}

function ribbonPolygons(color: string, tie: Vec3, radius: number): Polygon[] {
  return [
    ...ribbonBand(tie, radius, RIBBON_BAND_HALF_HEIGHT, RIBBON_BAND_TILT, 0, color),
    ...ribbonBand(tie, radius, RIBBON_BAND_HALF_HEIGHT, RIBBON_BAND_TILT, Math.PI, color),
  ];
}

export function buildBouquetParts(palette: Palette): BouquetParts {
  const random = createRandom(BOUQUET_SEED);
  const inventory: BouquetInventory = {
    creamRose: 0,
    lavenderRose: 0,
    lavenderSprig: 0,
    eucalyptus: 0,
    stem: 0,
    ribbon: 1,
  };
  const head = roseHead(palette, random, inventory);
  const foliageParts = foliage(palette, random, inventory);
  const lavender = lavenderSprigs(palette, random, inventory);
  const anchors = [...head.anchors, ...foliageParts.anchors];
  const stemAnchors = anchors.map(([x, y, z]): Vec3 => [
    x * STEM_ORIGIN_PULL,
    Math.min(y, STEM_ORIGIN_Y),
    z * STEM_ORIGIN_PULL,
  ]);
  const body = bodyPolygons({
    palette,
    anchors: stemAnchors,
    tieRadius: TIE_RADIUS,
    seed: BOUQUET_SEED + 1,
  });

  inventory.stem = anchors.length;

  const tieRadius = body.bundleRadius(body.tie[1]);
  const ribbonTie: Vec3 = [body.tie[0], body.tie[1] - RIBBON_DROP, body.tie[2]];
  const polygons = [
    ...body.polygons,
    ...ribbonPolygons(palette.ribbon, ribbonTie, tieRadius * RIBBON_CINCH),
    ...foliageParts.polygons,
    ...lavender,
    ...head.polygons,
  ];

  return { polygons: toGlyphSpace(polygons), inventory };
}

export function buildBouquet(palette: Palette): Polygon[] {
  return buildBouquetParts(palette).polygons;
}
