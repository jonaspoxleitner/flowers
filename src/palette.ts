export const PALETTE_STORAGE_KEY = "flowers.palette";

export const PALETTE_ROLES = [
  { key: "creamRose", label: "cream roses" },
  { key: "lavenderRose", label: "lavender roses" },
  { key: "lavenderSprig", label: "lavender sprigs" },
  { key: "eucalyptus", label: "eucalyptus" },
  { key: "stem", label: "stems" },
  { key: "ribbon", label: "satin ribbon" },
  { key: "backdrop", label: "backdrop" },
] as const;

export type PaletteRole = (typeof PALETTE_ROLES)[number]["key"];

export type Palette = Record<PaletteRole, string>;

export const DEFAULT_PALETTE: Palette = {
  creamRose: "#F3EAD8",
  lavenderRose: "#C6B8E0",
  lavenderSprig: "#8A7BA8",
  eucalyptus: "#A6BDB4",
  stem: "#93A868",
  ribbon: "#DCD3EA",
  backdrop: "#DCD5CC",
};

export const STAGE_INK_DARK = "#12100f";
export const STAGE_INK_LIGHT = "#f4efe6";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function readStoredEntries(): Record<string, unknown> | null {
  try {
    const raw = globalThis.localStorage?.getItem(PALETTE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function loadPalette(): Palette {
  const palette: Palette = { ...DEFAULT_PALETTE };
  const stored = readStoredEntries();
  if (!stored) return palette;

  for (const { key } of PALETTE_ROLES) {
    const value = stored[key];
    if (typeof value === "string" && HEX_COLOR.test(value)) palette[key] = value;
  }

  return palette;
}

export function savePalette(palette: Palette): void {
  try {
    globalThis.localStorage?.setItem(PALETTE_STORAGE_KEY, JSON.stringify(palette));
  } catch {
    // Storage is optional: private mode and quota failures leave the in-memory palette untouched.
  }
}

export function resetPalette(): Palette {
  try {
    globalThis.localStorage?.removeItem(PALETTE_STORAGE_KEY);
  } catch {
    // Storage is optional: a failed removal still yields the photo-derived defaults.
  }

  return { ...DEFAULT_PALETTE };
}
