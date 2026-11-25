import { describe, expect, it } from "vitest";
import { box, cellWidth, kvRow, padTo, renderBox, rule, token } from "./ascii";
import type { ChromeRow } from "./ascii";

function lines(output: string): string[] {
  return output.split("\n");
}

describe("ascii chrome", () => {
  it("measures and pads text in character cells", () => {
    expect(cellWidth("abc")).toBe(3);
    expect(cellWidth("│─┌")).toBe(3);

    expect(padTo("ab", 4)).toBe("ab  ");
    expect(padTo("abcd", 2)).toBe("ab");
    expect(padTo("ab", 0)).toBe("");
  });

  it("draws a horizontal rule", () => {
    expect(rule(3)).toBe("───");
    expect(rule(0)).toBe("");
  });

  it("normalizes hex values into tokens", () => {
    expect(token("#f3ead8")).toBe("#F3EAD8");
    expect(token("8a7ba8")).toBe("#8A7BA8");
  });

  it("fills a dotted row to an exact cell width", () => {
    const row = kvRow("cream roses", "#F3EAD8 ", 30);

    expect(cellWidth(row)).toBe(30);
    expect(row.startsWith("· cream roses ·")).toBe(true);
    expect(row.endsWith(" #F3EAD8 ")).toBe(true);
    expect(cellWidth(kvRow("a much longer label", "long value ", 8))).toBe(8);
  });

  it("boxes rows into aligned columns", () => {
    const output = box("bouquet", ["· cream roses #F3EAD8", "· stems"], 30);
    const rows = lines(output);

    expect(rows[0]).toBe(`┌─ BOUQUET ${rule(18)}┐`);
    expect(rows[1]).toBe(`│ ${padTo("· cream roses #F3EAD8", 26)} │`);
    expect(rows.at(-1)).toBe(`└${rule(28)}┘`);
    for (const row of rows) expect(cellWidth(row)).toBe(30);
  });

  it("reserves slot cells and keeps every row the same width", () => {
    const slot = { node: document.createElement("span"), cells: 4 };
    const row: ChromeRow = { text: "· label #FFFFFF", slot };
    const output = box("palette", ["· plain", row], 34);

    for (const line of lines(output)) expect(cellWidth(line)).toBe(34);
    expect(lines(output)[2]).toContain(`${" ".repeat(4)} │`);
  });

  it("renders slots in place and reports updatable text boxes", () => {
    const host = document.createElement("div");
    const input = document.createElement("input");
    const boxes = renderBox(host, "palette", [
      { text: kvRow("stems", "#93A868 ", 20), slot: { node: input, cells: 2 } },
    ]);

    expect(host.querySelector("pre.chrome")).not.toBeNull();
    expect(host.querySelector("input")).toBe(input);
    expect(input.style.inlineSize).toBe("2ch");
    expect(boxes).toHaveLength(1);
    expect(boxes[0]?.width).toBe(20);
    expect(boxes[0]?.node.data).toBe(kvRow("stems", "#93A868 ", 20));

    const renderedWidths = Array.from(host.querySelectorAll(".chrome-line"), (line) =>
      Array.from(line.childNodes).reduce((cells, node) => {
        if (node.nodeType === 3) return cells + cellWidth(node.textContent ?? "");
        return cells + parseInt((node as HTMLElement).style.inlineSize || "0", 10);
      }, 0),
    );
    expect(renderedWidths).toEqual([26, 26, 26]);

    if (!boxes[0]) return;
    boxes[0].node.data = padTo(kvRow("stems", "#000000 ", 20), boxes[0].width);
    expect(host.textContent).toContain("#000000");
  });
});
