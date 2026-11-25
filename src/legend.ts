import { PALETTE_ROLES } from "./palette";
import type { Palette } from "./palette";
import type { BouquetInventory } from "./bouquet";
import { kvRow, renderBox, token } from "./ui/ascii";
import type { ChromeRow } from "./ui/ascii";

const LEGEND_TITLE = "bouquet";
const LEGEND_WIDTH = 40;
const BOX_CHROME_CELLS = 4;
const SWATCH_CELLS = 2;
const ROW_TEXT_WIDTH = LEGEND_WIDTH - BOX_CHROME_CELLS - SWATCH_CELLS;

export function renderLegend(
  host: HTMLElement,
  palette: Palette,
  inventory: BouquetInventory,
): void {
  const rows: ChromeRow[] = [];

  for (const role of PALETTE_ROLES) {
    if (role.key === "backdrop") continue;

    const swatch = host.ownerDocument.createElement("span");
    swatch.className = "swatch";
    swatch.style.setProperty("background-color", palette[role.key]);
    swatch.setAttribute("aria-hidden", "true");

    rows.push({
      text: kvRow(
        role.label,
        `${token(palette[role.key])} ×${inventory[role.key]} `,
        ROW_TEXT_WIDTH,
      ),
      slot: { node: swatch, cells: SWATCH_CELLS },
    });
  }

  renderBox(host, LEGEND_TITLE, rows, LEGEND_WIDTH);
}
