export type Random = () => number;

export function createRandom(seed: number): Random {
  let state = seed % 4294967296;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export function randomRange(random: Random, min: number, max: number): number {
  return min + random() * (max - min);
}
