import { cylinderPolygons, orientedRibbonPolygons } from "@glyphcss/core";
import type { Polygon, Vec3 } from "@glyphcss/core";
import type { Palette } from "../palette";
import { createRandom, randomRange } from "./random";
import { BASE_SHADE, RAMP_STEPS, shadeRamp } from "./shade";

const DEGREES = Math.PI / 180;
const LEAF_SIDES = 10;
const LEAF_THICKNESS = 0.03;
const LEAF_TILT_DEGREES = 52;
const LEAF_SPIN_DEGREES = 72;
const LEAF_ELONGATION = 1.35;
const SPRIG_REACH = 0.12;
const STEM_THICKNESS = 0.028;

const LEAF_COUNT_MIN = 5;
const LEAF_COUNT_MAX = 7;
const STEM_SEGMENTS = 2;

export type EucalyptusOptions = {
  readonly palette: Palette;
  readonly color: string;
  readonly radius: number;
  readonly length: number;
  readonly seed: number;
};

function pointAlong(length: number, along: number): Vec3 {
  const reach = length * SPRIG_REACH;
  const inverse = 1 - along;

  return [2 * inverse * along * reach, along * along * -length, 0];
}

function leafPolygons(
  center: Vec3,
  radius: number,
  tilt: number,
  spin: number,
  color: string,
): Polygon[] {
  const disc = cylinderPolygons({
    center: [0, 0, 0],
    radius,
    height: LEAF_THICKNESS,
    sides: LEAF_SIDES,
    color,
  });
  const cosTilt = Math.cos(tilt);
  const sinTilt = Math.sin(tilt);
  const cosSpin = Math.cos(spin);
  const sinSpin = Math.sin(spin);

  return disc.map((polygon) => ({
    ...polygon,
    vertices: polygon.vertices.map(([rawX, y, z]): Vec3 => {
      const x = rawX * LEAF_ELONGATION;
      const tiltedX = x * cosTilt - y * sinTilt;
      const tiltedY = x * sinTilt + y * cosTilt;
      return [
        tiltedX * cosSpin + z * sinSpin + center[0],
        tiltedY + center[1],
        -tiltedX * sinSpin + z * cosSpin + center[2],
      ];
    }),
  }));
}

export function eucalyptusPolygons(options: EucalyptusOptions): Polygon[] {
  const { color, radius, length, seed } = options;
  const random = createRandom(seed);
  const ramp = shadeRamp(color, RAMP_STEPS);
  const stemColor = ramp[BASE_SHADE - 2] ?? color;
  const leafCount = LEAF_COUNT_MIN + Math.floor(random() * (LEAF_COUNT_MAX - LEAF_COUNT_MIN + 1));
  const polygons: Polygon[] = [];

  for (let index = 0; index < STEM_SEGMENTS; index += 1) {
    const from = pointAlong(length, index / STEM_SEGMENTS);
    const to = pointAlong(length, (index + 1) / STEM_SEGMENTS);
    polygons.push(...orientedRibbonPolygons(from, to, STEM_THICKNESS, stemColor));
  }

  for (let index = 0; index < leafCount; index += 1) {
    const along = 0.24 + (index / (leafCount - 1)) * 0.7;
    const side = index % 2 === 0 ? 1 : -1;
    const leafRadius = radius * (0.58 - 0.3 * along) * randomRange(random, 0.9, 1.1);
    const spine = pointAlong(length, along);
    const center: Vec3 = [spine[0], spine[1], side * leafRadius * 0.75];
    const tilt = side * (LEAF_TILT_DEGREES + randomRange(random, -12, 12)) * DEGREES;
    const spin = side * LEAF_SPIN_DEGREES * DEGREES + randomRange(random, -0.3, 0.3);

    polygons.push(
      ...leafPolygons(center, leafRadius, tilt, spin, ramp[BASE_SHADE - 1 + (index % 3)] ?? color),
    );
  }

  return polygons;
}
