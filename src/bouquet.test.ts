import { describe, expect, it } from "vitest";
import type { Polygon, Vec3 } from "@glyphcss/core";
import { buildBouquet, buildBouquetParts, POLYGON_BUDGET, TIE_RADIUS } from "./bouquet";
import { BODY_TIE_Y } from "./flowers/body";
import { eucalyptusPolygons } from "./flowers/eucalyptus";
import { ROSE_CENTRE_TONE, ROSE_PETALS, ROSE_RINGS, rosePolygons } from "./flowers/rose";
import { BASE_SHADE, RAMP_STEPS, shadeRamp } from "./flowers/shade";
import { DEFAULT_PALETTE } from "./palette";
import type { Palette } from "./palette";

const HEAD_LINK_DISTANCE = 0.14;
const HEAD_REACH = 1.05;
const HEAD_POPULATION = 12;
const HEAD_POPULATION_RADIUS = 0.8;

const polygons = buildBouquet(DEFAULT_PALETTE);
const { inventory } = buildBouquetParts(DEFAULT_PALETTE);

function rampColors(color: string): readonly string[] {
  return shadeRamp(color, RAMP_STEPS);
}

function rolePolygons(color: string): Polygon[] {
  const ramp = new Set(rampColors(color));
  return polygons.filter((polygon) => ramp.has((polygon.color ?? "").toUpperCase()));
}

// Leaves carry the middle ramp tones; the sprig stem is pinned to the darkest tone.
function leafPolygons(list: Polygon[], color: string): Polygon[] {
  const tones = new Set(rampColors(color).slice(BASE_SHADE - 1, BASE_SHADE + 2));
  return list.filter((polygon) => tones.has((polygon.color ?? "").toUpperCase()));
}

function widestReach(list: Polygon[]): number {
  return Math.max(...list.flatMap((polygon) => polygon.vertices.map(([x, y]) => Math.hypot(x, y))));
}

function bounds(list: Polygon[]): { min: Vec3; max: Vec3 } {
  const coordinates = [0, 1, 2].map((axis) =>
    list.flatMap((polygon) => polygon.vertices.map((vertex) => vertex[axis])),
  );

  return {
    min: [Math.min(...coordinates[0]), Math.min(...coordinates[1]), Math.min(...coordinates[2])],
    max: [Math.max(...coordinates[0]), Math.max(...coordinates[1]), Math.max(...coordinates[2])],
  };
}

function centroid(polygon: Polygon): Vec3 {
  const sum = polygon.vertices.reduce<Vec3>(
    (total, [x, y, z]) => [total[0] + x, total[1] + y, total[2] + z],
    [0, 0, 0],
  );
  const count = polygon.vertices.length;
  return [sum[0] / count, sum[1] / count, sum[2] / count];
}

// Single-linkage clustering of polygon centroids, used to recover rose heads from their bud cores.
function clusterCentroids(points: readonly Vec3[], link: number): Vec3[][] {
  const parents = points.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parents[root] !== root) root = parents[root];
    parents[index] = root;
    return root;
  };

  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      const [ax, ay, az] = points[first];
      const [bx, by, bz] = points[second];
      if (Math.hypot(ax - bx, ay - by, az - bz) > link) continue;

      const left = find(first);
      const right = find(second);
      if (left !== right) parents[left] = right;
    }
  }

  const groups = new Map<number, Vec3[]>();
  points.forEach((point, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) ?? []), point]);
  });

  return [...groups.values()];
}

function headCenters(color: string): Vec3[] {
  const buds = rolePolygons(color).filter(
    (polygon) => polygon.color === rampColors(color)[ROSE_CENTRE_TONE],
  );

  return clusterCentroids(buds.map(centroid), HEAD_LINK_DISTANCE).map((group) => {
    const sum = group.reduce<Vec3>(
      (total, point) => [total[0] + point[0], total[1] + point[1], total[2] + point[2]],
      [0, 0, 0],
    );
    return [sum[0] / group.length, sum[1] / group.length, sum[2] / group.length] as Vec3;
  });
}

// Widest horizontal reach of any edge crossing a given height in the glyph frame, where Z is up.
function radiusAtHeight(height: number): number {
  let widest = 0;

  for (const polygon of polygons) {
    const vertices = polygon.vertices;
    for (let index = 0; index < vertices.length; index += 1) {
      const from = vertices[index];
      const to = vertices[(index + 1) % vertices.length];
      const low = Math.min(from[2], to[2]);
      const high = Math.max(from[2], to[2]);
      if (height < low || height > high) continue;

      const along = (height - from[2]) / (to[2] - from[2] || 1);
      const x = from[0] + (to[0] - from[0]) * along;
      const y = from[1] + (to[1] - from[1]) * along;
      widest = Math.max(widest, Math.hypot(x, y));
    }
  }

  return widest;
}

describe("buildBouquet", () => {
  it("keeps the total polygon count inside the declared budget", () => {
    expect(polygons.length).toBeGreaterThanOrEqual(POLYGON_BUDGET.min);
    expect(polygons.length).toBeLessThanOrEqual(POLYGON_BUDGET.max);
  });

  it("shingles every rose ring over the head and tightens toward the centre", () => {
    expect(ROSE_RINGS.length).toBeGreaterThanOrEqual(3);

    for (const ring of ROSE_RINGS) {
      expect(ring.root).toBeGreaterThan(ring.apex);
      expect(ring.halfSpan * 2).toBeGreaterThan(360 / ring.petals);
    }

    for (let index = 1; index < ROSE_RINGS.length; index += 1) {
      const outer = ROSE_RINGS[index - 1];
      const inner = ROSE_RINGS[index];
      expect(inner.root).toBeLessThan(outer.root);
      expect(inner.apex).toBeLessThan(outer.apex);
    }

    expect(ROSE_RINGS[0].root).toBeGreaterThan(150);
    expect(ROSE_RINGS[0].apex).toBeLessThan(100);
    expect(ROSE_RINGS[ROSE_RINGS.length - 1].apex).toBeLessThan(35);
    expect(ROSE_PETALS.length).toBeGreaterThanOrEqual(12);
  });

  it("closes each rose head so the backdrop never shows through it", () => {
    const radius = 0.5;
    const rose = rosePolygons({
      palette: DEFAULT_PALETTE,
      color: DEFAULT_PALETTE.creamRose,
      radius,
      seed: 20240517,
    });
    const facing = rose.map((polygon) =>
      polygon.vertices.map(([x, , z]): [number, number] => [x, z]),
    );
    const centreColor = rampColors(DEFAULT_PALETTE.creamRose)[ROSE_CENTRE_TONE];
    const petals = rose
      .filter((polygon) => polygon.color !== centreColor)
      .map((polygon) => polygon.vertices.map(([x, , z]): [number, number] => [x, z]));

    // Rose petals are built about Y; the head's footprint is the XZ disc.
    const inside = ([px, pz]: [number, number], outline: readonly [number, number][]): boolean => {
      let hit = false;
      for (
        let index = 0, previous = outline.length - 1;
        index < outline.length;
        previous = index++
      ) {
        const [ax, az] = outline[index];
        const [bx, bz] = outline[previous];
        if (az > pz !== bz > pz && px < ((bx - ax) * (pz - az)) / (bz - az) + ax) hit = !hit;
      }
      return hit;
    };

    const samples = 17;
    const reach = radius * 0.85;
    let uncovered = 0;
    let petalled = 0;
    let total = 0;

    for (let row = 0; row < samples; row += 1) {
      for (let column = 0; column < samples; column += 1) {
        const px = ((column + 0.5) / samples - 0.5) * reach * 2;
        const pz = ((row + 0.5) / samples - 0.5) * reach * 2;
        if (Math.hypot(px, pz) > reach) continue;

        total += 1;
        if (!facing.some((outline) => inside([px, pz], outline))) uncovered += 1;
        if (petals.some((outline) => inside([px, pz], outline))) petalled += 1;
      }
    }

    expect(uncovered).toBe(0);
    expect(petalled / total).toBeGreaterThan(0.9);
  });

  it("assembles the documented mix of flowers, foliage, stems, and ribbon", () => {
    expect(inventory.creamRose).toBeGreaterThanOrEqual(4);
    expect(inventory.creamRose).toBeLessThanOrEqual(6);
    expect(inventory.lavenderRose).toBeGreaterThanOrEqual(3);
    expect(inventory.lavenderRose).toBeLessThanOrEqual(4);
    expect(inventory.eucalyptus).toBeGreaterThanOrEqual(6);
    expect(inventory.eucalyptus).toBeLessThanOrEqual(8);
    expect(inventory.lavenderSprig).toBeGreaterThanOrEqual(5);
    expect(inventory.lavenderSprig).toBeLessThanOrEqual(7);
    expect(inventory.stem).toBeGreaterThanOrEqual(10);
    expect(inventory.ribbon).toBe(1);
  });

  it("builds every rose head around its own bud", () => {
    for (const role of ["creamRose", "lavenderRose"] as const) {
      const centers = headCenters(DEFAULT_PALETTE[role]);
      expect(centers).toHaveLength(inventory[role]);

      const head = rolePolygons(DEFAULT_PALETTE[role]);
      for (const polygon of head) {
        const point = centroid(polygon);
        const nearest = Math.min(
          ...centers.map((center) =>
            Math.hypot(point[0] - center[0], point[1] - center[1], point[2] - center[2]),
          ),
        );
        expect(nearest).toBeLessThan(HEAD_REACH);
      }

      for (const center of centers) {
        const near = head.filter(
          (polygon) =>
            Math.hypot(...centroid(polygon).map((value, axis) => value - center[axis])) <
            HEAD_POPULATION_RADIUS,
        );
        expect(near.length).toBeGreaterThan(HEAD_POPULATION);
      }
    }
  });

  it("cinches the ribbon inside the bundle instead of banding it like a barrel", () => {
    const ribbon = polygons.filter((polygon) => polygon.color === DEFAULT_PALETTE.ribbon);
    expect(ribbon.length).toBeGreaterThanOrEqual(16);

    // A barrel would carry n-gon caps; the tie is built from open quad bands only.
    for (const polygon of ribbon) expect(polygon.vertices).toHaveLength(4);

    const reach = Math.max(
      ...ribbon.flatMap((polygon) => polygon.vertices.map(([x, y]) => Math.hypot(x, y))),
    );
    const height = bounds(ribbon);

    expect(reach).toBeLessThan(TIE_RADIUS);
    expect(height.max[2] - height.min[2]).toBeLessThan(0.32);
  });

  it("gathers every stem at the tie and keeps the stubs bunched below it", () => {
    const stems = polygons.filter((polygon) => polygon.color === DEFAULT_PALETTE.stem);
    expect(stems.length).toBeGreaterThan(0);

    const vertices = stems.flatMap((polygon) => polygon.vertices);
    const nearTie = vertices.filter(([, , z]) => Math.abs(z - BODY_TIE_Y) <= 0.012);
    expect(nearTie.length).toBeGreaterThan(0);
    const closest = Math.min(...nearTie.map(([x, y]) => Math.hypot(x, y)));
    expect(closest).toBeLessThan(TIE_RADIUS * 0.3);

    const stubs = vertices.filter(([, , z]) => z < BODY_TIE_Y - 0.08);
    expect(stubs.length).toBeGreaterThan(0);
    const widestStub = Math.max(...stubs.map(([x, y]) => Math.hypot(x, y)));
    expect(widestStub).toBeLessThan(TIE_RADIUS * 1.6);

    const lowest = Math.min(...vertices.map(([, , z]) => z));
    expect(BODY_TIE_Y - lowest).toBeLessThan(0.55);
  });

  it("grows eucalyptus sprigs as several leaves along a tapered stem", () => {
    const color = DEFAULT_PALETTE.eucalyptus;
    const length = 0.6;
    const sprig = eucalyptusPolygons({
      palette: DEFAULT_PALETTE,
      color,
      radius: 0.24,
      length,
      seed: 424242,
    });
    const leaves = leafPolygons(sprig, color);
    expect(leaves.length).toBeGreaterThan(0);

    const centroids = leaves.map(centroid);
    const heights = centroids.map(([, y]) => y);
    const bottom = Math.min(...heights);
    const top = Math.max(...heights);
    expect(top - bottom).toBeGreaterThan(length * 0.5);

    const bins = 6;
    const stations = new Set(
      heights.map((y) => Math.min(bins - 1, Math.floor(((y - bottom) / (top - bottom)) * bins))),
    );
    expect(stations.size).toBeGreaterThanOrEqual(bins - 1);

    const reach = (subset: Polygon[]): number =>
      Math.max(
        ...subset.flatMap((polygon) => polygon.vertices.map(([x, , z]) => Math.hypot(x, z))),
      );
    const nearTip = leaves.filter((polygon) => centroid(polygon)[1] < bottom + length * 0.15);
    const nearBase = leaves.filter((polygon) => centroid(polygon)[1] > top - length * 0.15);
    expect(nearTip.length).toBeGreaterThan(0);
    expect(nearBase.length).toBeGreaterThan(0);
    expect(reach(nearTip)).toBeLessThan(reach(nearBase));
  });

  it("frames the rose heads with eucalyptus outside and below them", () => {
    const leaves = leafPolygons(polygons, DEFAULT_PALETTE.eucalyptus);
    const centroids = leaves.map(centroid);
    const above = centroids.filter(([, , z]) => z > 0.4);
    const below = centroids.filter(([, , z]) => z < 0);

    expect(above.length).toBeGreaterThan(50);
    expect(below.length).toBeGreaterThan(50);

    const roses = [
      ...rolePolygons(DEFAULT_PALETTE.creamRose),
      ...rolePolygons(DEFAULT_PALETTE.lavenderRose),
    ];
    expect(widestReach(leaves)).toBeGreaterThan(widestReach(roses) + 0.1);

    const heights = centroids.map(([, , z]) => z);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.8);
  });

  it("narrows steadily from the head crown down to the tie", () => {
    const crown = radiusAtHeight(0.75);
    const tie = radiusAtHeight(BODY_TIE_Y);

    expect(crown).toBeGreaterThan(1);
    expect(tie).toBeLessThan(crown * 0.5);

    const samples = [0.75, 0.6, 0.45, 0.3, 0.15, 0, -0.15, BODY_TIE_Y];
    const profile = samples.map(radiusAtHeight);

    for (const [index, radius] of profile.entries()) {
      if (index === 0) continue;
      expect(radius).toBeLessThanOrEqual(profile[index - 1] * 1.15);
    }

    expect(profile[profile.length - 1]).toBeLessThan(profile[0] * 0.5);
  });

  it("fills the space between the heads and the tie", () => {
    const crown = radiusAtHeight(0.75);
    const tie = radiusAtHeight(BODY_TIE_Y);

    for (const height of [0.6, 0.45, 0.3, 0.15, 0, -0.15, BODY_TIE_Y]) {
      const along = (0.75 - height) / (0.75 - BODY_TIE_Y);
      const taper = crown + (tie - crown) * along;
      expect(radiusAtHeight(height)).toBeGreaterThan(taper * 0.6);
    }
  });

  it("centers the head over the stem bundle", () => {
    const { min, max } = bounds(polygons);

    expect(Math.abs((min[0] + max[0]) / 2)).toBeLessThan(0.25);
    expect(Math.abs((min[1] + max[1]) / 2)).toBeLessThan(0.25);
    expect(max[2]).toBeGreaterThan(1);
    expect(min[2]).toBeLessThan(-0.7);
  });

  it("keeps every vertex finite", () => {
    for (const polygon of polygons) {
      for (const vertex of polygon.vertices) {
        expect(vertex).toHaveLength(3);
        for (const coordinate of vertex) expect(Number.isFinite(coordinate)).toBe(true);
      }
    }
  });

  it("colors every polygon from the palette or its shade ramp", () => {
    const allowed = new Set<string>();
    for (const color of Object.values(DEFAULT_PALETTE)) {
      allowed.add(color);
      for (const shade of rampColors(color)) allowed.add(shade);
    }

    for (const polygon of polygons) {
      expect(polygon.color).toBeDefined();
      expect(allowed.has(polygon.color ?? "")).toBe(true);
    }
  });

  it("is deterministic across calls", () => {
    expect(buildBouquet(DEFAULT_PALETTE)).toEqual(polygons);
  });

  it("reports the inventory it built", () => {
    expect(inventory.ribbon).toBe(1);
    expect(inventory.stem).toBe(
      inventory.creamRose + inventory.lavenderRose + inventory.eucalyptus,
    );
  });

  it("keeps geometry identical when only the palette changes", () => {
    const recolored: Palette = {
      ...DEFAULT_PALETTE,
      creamRose: "#101820",
      lavenderRose: "#203040",
      eucalyptus: "#304050",
      ribbon: "#405060",
    };
    const alternative = buildBouquet(recolored);

    expect(alternative).toHaveLength(polygons.length);
    for (const [index, polygon] of polygons.entries()) {
      expect(alternative[index].vertices).toEqual(polygon.vertices);
    }

    expect(alternative.map(({ color }) => color)).not.toEqual(polygons.map(({ color }) => color));
  });
});
