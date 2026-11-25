import { orientedRibbonPolygons } from "@glyphcss/core";
import type { Polygon, Vec3 } from "@glyphcss/core";
import type { Palette } from "../palette";
import { createRandom, randomRange } from "./random";

const STEM_HALF_WIDTH = 0.034;
const STEM_BOW = 0.05;
const TIE_PATH_FACTOR = 0.05;
const TIE_JITTER = 0.012;
const BUNCH_DROP = 0.06;
const BUNCH_FACTOR = 0.72;
const SPLAY_FACTOR = 1.2;
const SPLAY_JITTER = 0.015;

export const BODY_TIE_Y = -0.38;
const BODY_BOTTOM_Y = -0.82;

export type BodyOptions = {
  readonly palette: Palette;
  readonly anchors: readonly Vec3[];
  readonly tieRadius: number;
  readonly seed: number;
};

export type BodyParts = {
  readonly polygons: Polygon[];
  readonly tie: Vec3;
  bundleRadius(y: number): number;
};

export function bodyPolygons(options: BodyOptions): BodyParts {
  const { palette, anchors, tieRadius } = options;
  const random = createRandom(options.seed);
  const stemColor = palette.stem;
  const tie: Vec3 = [0, BODY_TIE_Y, 0];
  const topRadius = anchors.reduce(
    (widest, [x, , z]) => Math.max(widest, Math.hypot(x, z)),
    tieRadius,
  );
  const topY = anchors.reduce((highest, [, y]) => Math.max(highest, y), BODY_TIE_Y);
  const polygons: Polygon[] = [];

  for (const anchor of anchors) {
    const azimuth = Math.atan2(anchor[2], anchor[0]);
    const radius = Math.hypot(anchor[0], anchor[2]);
    const midRadius = (radius + tieRadius) / 2 + STEM_BOW;
    const mid: Vec3 = [
      Math.cos(azimuth) * midRadius,
      (anchor[1] + BODY_TIE_Y) / 2,
      Math.sin(azimuth) * midRadius,
    ];
    const cinch: Vec3 = [
      Math.cos(azimuth) * tieRadius * TIE_PATH_FACTOR +
        randomRange(random, -TIE_JITTER, TIE_JITTER),
      BODY_TIE_Y + randomRange(random, -0.015, 0.015),
      Math.sin(azimuth) * tieRadius * TIE_PATH_FACTOR +
        randomRange(random, -TIE_JITTER, TIE_JITTER),
    ];
    const bunchRadius = tieRadius * BUNCH_FACTOR + randomRange(random, -SPLAY_JITTER, SPLAY_JITTER);
    const bunch: Vec3 = [
      Math.cos(azimuth) * bunchRadius,
      BODY_TIE_Y - BUNCH_DROP,
      Math.sin(azimuth) * bunchRadius,
    ];
    const splayRadius = tieRadius * SPLAY_FACTOR + randomRange(random, -SPLAY_JITTER, SPLAY_JITTER);
    const tail: Vec3 = [
      Math.cos(azimuth) * splayRadius,
      BODY_BOTTOM_Y + randomRange(random, -0.04, 0.04),
      Math.sin(azimuth) * splayRadius,
    ];

    polygons.push(...orientedRibbonPolygons(anchor, mid, STEM_HALF_WIDTH, stemColor));
    polygons.push(...orientedRibbonPolygons(mid, cinch, STEM_HALF_WIDTH, stemColor));
    polygons.push(...orientedRibbonPolygons(cinch, bunch, STEM_HALF_WIDTH, stemColor));
    polygons.push(...orientedRibbonPolygons(bunch, tail, STEM_HALF_WIDTH, stemColor));
  }

  const bundleRadius = (y: number): number => {
    if (y >= topY) return topRadius;

    if (y >= BODY_TIE_Y) {
      const along = (topY - y) / (topY - BODY_TIE_Y);
      return topRadius + (tieRadius - topRadius) * along;
    }

    const along = Math.min(1, (BODY_TIE_Y - y) / (BODY_TIE_Y - BODY_BOTTOM_Y));
    return tieRadius + (tieRadius * SPLAY_FACTOR - tieRadius) * along;
  };

  return { polygons, tie, bundleRadius };
}
