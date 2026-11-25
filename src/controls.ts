import { PALETTE_ROLES } from "./palette";
import type { Palette, PaletteRole } from "./palette";
import { cellWidth, kvRow, padTo, renderBox, token } from "./ui/ascii";
import type { ChromeRow } from "./ui/ascii";

const CONTROLS_TITLE = "palette";
const CONTROLS_WIDTH = 40;
const BOX_CHROME_CELLS = 4;
const SWATCH_INPUT_CELLS = 2;
const RESET_LABEL = "[ RESET ]";
const RESET_CELLS = cellWidth(RESET_LABEL);
const ROW_TEXT_WIDTH = CONTROLS_WIDTH - BOX_CHROME_CELLS - SWATCH_INPUT_CELLS;
const RESET_TEXT_WIDTH = ROW_TEXT_WIDTH + SWATCH_INPUT_CELLS - RESET_CELLS;

type RoleEntry = (typeof PALETTE_ROLES)[number];

export type PaletteEditorHandlers = {
  onChange(role: PaletteRole, value: string): void;
  onReset(): void;
};

export type PaletteEditor = {
  render(palette: Palette): void;
};

function roleText(role: RoleEntry, palette: Palette): string {
  return kvRow(role.label, `${token(palette[role.key])} `, ROW_TEXT_WIDTH);
}

export function createPaletteEditor(
  host: HTMLElement,
  palette: Palette,
  handlers: PaletteEditorHandlers,
): PaletteEditor {
  const doc = host.ownerDocument;
  const inputs = new Map<PaletteRole, HTMLInputElement>();
  const rows: ChromeRow[] = PALETTE_ROLES.map((role) => {
    const input = doc.createElement("input");
    input.type = "color";
    input.className = "swatch-input";
    input.value = palette[role.key];
    input.setAttribute("aria-label", role.label);
    input.addEventListener("input", () => handlers.onChange(role.key, input.value));
    inputs.set(role.key, input);

    return {
      text: roleText(role, palette),
      slot: { node: input, cells: SWATCH_INPUT_CELLS },
    };
  });

  const reset = doc.createElement("button");
  reset.type = "button";
  reset.className = "text-button";
  reset.textContent = RESET_LABEL;
  reset.addEventListener("click", handlers.onReset);
  rows.push({
    text: kvRow("actions", " ", RESET_TEXT_WIDTH),
    slot: { node: reset, cells: RESET_CELLS },
  });

  const textBoxes = renderBox(host, CONTROLS_TITLE, rows, CONTROLS_WIDTH);

  return {
    render(next: Palette) {
      for (const [index, role] of PALETTE_ROLES.entries()) {
        const textBox = textBoxes[index];
        if (!textBox) continue;
        textBox.node.data = padTo(roleText(role, next), textBox.width);

        const input = inputs.get(role.key);
        if (input) input.value = next[role.key];
      }
    },
  };
}
