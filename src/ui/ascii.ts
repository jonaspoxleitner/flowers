export type ChromeSlot = { readonly node: HTMLElement; readonly cells: number };

export type ChromeRow = { readonly text: string; readonly slot?: ChromeSlot };

export type ChromeLine = string | ChromeRow;

export type ChromeTextBox = { readonly node: Text; readonly width: number };

const TOP_LEFT = "┌";
const TOP_RIGHT = "┐";
const BOTTOM_LEFT = "└";
const BOTTOM_RIGHT = "┘";
const HORIZONTAL = "─";
const VERTICAL = "│";
const DOT = "·";

type RowLayout = { readonly text: string; readonly slotCells: number };

type BoxLayout = { readonly width: number; readonly rows: readonly RowLayout[] };

function cellsOf(text: string): string[] {
  return Array.from(text);
}

export function cellWidth(text: string): number {
  return cellsOf(text).length;
}

export function padTo(text: string, width: number): string {
  const cells = cellsOf(text);
  const target = Math.max(0, width);
  if (cells.length >= target) return cells.slice(0, target).join("");
  return text + " ".repeat(target - cells.length);
}

export function token(value: string): string {
  return `#${value.replace("#", "").toUpperCase()}`;
}

export function rule(width: number): string {
  return HORIZONTAL.repeat(Math.max(0, Math.floor(width)));
}

export function kvRow(label: string, value: string, width: number): string {
  const lead = `${DOT} ${label} `;
  const tail = ` ${value}`;
  const gap = Math.max(0, width) - cellWidth(lead) - cellWidth(tail);
  if (gap < 1) return padTo(lead + tail, width);
  return lead + DOT.repeat(gap) + tail;
}

function lineCells(line: ChromeLine): number {
  if (typeof line === "string") return cellWidth(line);
  return cellWidth(line.text) + (line.slot?.cells ?? 0);
}

function topBorder(title: string, width: number): string {
  const inner = width - 2;
  if (cellWidth(title) === 0) return `${TOP_LEFT}${rule(inner)}${TOP_RIGHT}`;
  const segment = `${HORIZONTAL} ${title.toUpperCase()} `;
  return `${TOP_LEFT}${segment}${rule(inner - cellWidth(segment))}${TOP_RIGHT}`;
}

function bottomBorder(width: number): string {
  return `${BOTTOM_LEFT}${rule(width - 2)}${BOTTOM_RIGHT}`;
}

function layoutBox(title: string, lines: readonly ChromeLine[], width?: number): BoxLayout {
  const contentWidth = lines.reduce(
    (widest, line) => Math.max(widest, lineCells(line)),
    cellWidth(title) + 2,
  );
  const boxWidth = Math.max(width ?? 0, contentWidth + 4);
  const available = boxWidth - 4;
  const rows = lines.map((line): RowLayout => {
    const text = typeof line === "string" ? line : line.text;
    const slotCells = typeof line === "string" ? 0 : (line.slot?.cells ?? 0);
    return { text: padTo(text, available - slotCells), slotCells };
  });

  return { width: boxWidth, rows };
}

export function box(title: string, lines: readonly ChromeLine[], width?: number): string {
  const layout = layoutBox(title, lines, width);
  const body = layout.rows.map(
    (row) => `${VERTICAL} ${row.text}${" ".repeat(row.slotCells)} ${VERTICAL}`,
  );

  return [topBorder(title, layout.width), ...body, bottomBorder(layout.width)].join("\n");
}

export function renderBox(
  host: HTMLElement,
  title: string,
  lines: readonly ChromeLine[],
  width?: number,
): ChromeTextBox[] {
  const layout = layoutBox(title, lines, width);
  const doc = host.ownerDocument;
  const frame = doc.createElement("pre");
  frame.className = "chrome";
  frame.style.setProperty("inline-size", `${layout.width}ch`);
  host.replaceChildren(frame);

  const appendLine = (...parts: readonly (Node | string)[]): void => {
    const line = doc.createElement("span");
    line.className = "chrome-line";
    line.append(...parts);
    frame.append(line);
  };

  appendLine(topBorder(title, layout.width));
  const boxes: ChromeTextBox[] = [];

  layout.rows.forEach((row, index) => {
    const source = lines[index];
    const slot = typeof source === "string" ? undefined : source.slot;
    const text = doc.createTextNode(row.text);
    boxes.push({ node: text, width: cellWidth(row.text) });
    if (!slot) {
      appendLine(`${VERTICAL} `, text, `${" ".repeat(row.slotCells)} ${VERTICAL}`);
      return;
    }
    slot.node.style.setProperty("inline-size", `${slot.cells}ch`);
    appendLine(`${VERTICAL} `, text, slot.node, ` ${VERTICAL}`);
  });

  appendLine(bottomBorder(layout.width));

  return boxes;
}
