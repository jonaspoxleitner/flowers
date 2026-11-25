export const RAMP_STEPS = 5;
export const BASE_SHADE = 2;

const DARKEST_MIX = 0.45;
const LIGHTEST_MIX = 0.55;
const ramps = new Map<string, readonly string[]>();

function toHex(channel: number): string {
  return Math.round(Math.min(255, Math.max(0, channel)))
    .toString(16)
    .padStart(2, "0");
}

export function shadeRamp(color: string, steps: number): readonly string[] {
  const key = `${color}:${steps}`;
  const cached = ramps.get(key);
  if (cached) return cached;

  const channels = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  const ramp = Array.from({ length: steps }, (_, index) => {
    const position = steps === 1 ? 0.5 : index / (steps - 1);
    const towardsDark = position < 0.5;
    const amount = towardsDark
      ? (0.5 - position) * 2 * DARKEST_MIX
      : (position - 0.5) * 2 * LIGHTEST_MIX;
    const target = towardsDark ? 0 : 255;
    const mixed = channels.map((channel) => toHex(channel + (target - channel) * amount));
    return `#${mixed.join("")}`.toUpperCase();
  });

  ramps.set(key, ramp);
  return ramp;
}
