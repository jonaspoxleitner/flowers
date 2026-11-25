import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GlyphSceneHandle } from "glyphcss";
import { buildBouquet } from "./bouquet";
import { guardFrameBudget, mountPage, mountScene } from "./main";
import { DEFAULT_PALETTE, PALETTE_STORAGE_KEY, loadPalette } from "./palette";

function createHost(): HTMLElement {
  const host = document.createElement("div");
  document.body.append(host);
  return host;
}

describe("scene", () => {
  it("mounts the bouquet as a solid, auto-sized quadrant glyph scene", () => {
    const host = createHost();

    const view = mountScene(host, buildBouquet(DEFAULT_PALETTE));
    const options = view.scene.getOptions();

    expect(host.querySelector("pre")).not.toBeNull();
    expect(options.mode).toBe("solid");
    expect(options.charMode).toBe("quadrant");
    expect(options.autoSize).toBe(true);
    expect(options.interactiveDownscale).toBe(2);
    expect(options.cols).toBe(120);
    expect(options.rows).toBe(44);

    view.destroy();
    host.remove();
  });

  it("recolors the mounted mesh in place", () => {
    const host = createHost();

    const view = mountScene(host, buildBouquet(DEFAULT_PALETTE));
    const before = view.scene.output.innerHTML;

    view.setPalette({
      ...DEFAULT_PALETTE,
      creamRose: "#FF0000",
      lavenderRose: "#00FF00",
      eucalyptus: "#0000FF",
      stem: "#FFFF00",
    });

    expect(view.scene.output.innerHTML).not.toBe(before);

    view.destroy();
    host.remove();
  });
});

describe("frame budget", () => {
  function createBudgetHarness() {
    let pending: FrameRequestCallback | null = null;
    let clock = 0;

    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      pending = callback;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(performance, "now").mockImplementation(() => clock);

    const setOptions = vi.fn();
    const refit = vi.fn();
    const scene = {
      getBaseResolution: () => ({ cols: 120, rows: 44 }),
      setOptions,
    } as unknown as GlyphSceneHandle;

    const runFrames = (count: number, step: number): void => {
      for (let index = 0; index < count; index += 1) {
        clock += step;
        const callback = pending;
        pending = null;
        callback?.(clock);
      }
    };

    return { scene, setOptions, refit, runFrames };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("drops the grid once when the measured frame budget is missed", () => {
    const harness = createBudgetHarness();
    const stop = guardFrameBudget(harness.scene, harness.refit);

    harness.runFrames(60, 40);

    expect(harness.setOptions).toHaveBeenCalledWith({ autoSize: false, cols: 84, rows: 31 });
    expect(harness.refit).toHaveBeenCalledTimes(1);

    stop();
  });

  it("leaves the grid alone while frames stay inside the budget", () => {
    const harness = createBudgetHarness();
    const stop = guardFrameBudget(harness.scene, harness.refit);

    harness.runFrames(120, 10);

    expect(harness.setOptions).not.toHaveBeenCalled();
    expect(harness.refit).not.toHaveBeenCalled();

    stop();
  });
});

describe("page", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the legend and the palette editor", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const hosts = { scene: createHost(), legend: createHost(), controls: createHost() };
    const page = mountPage(hosts);

    const legend = hosts.legend.textContent ?? "";
    expect(legend).toContain("BOUQUET");
    expect(legend).toContain("cream roses");
    expect(legend).toContain("#F3EAD8");
    expect(legend).toContain("eucalyptus");
    expect(legend).toContain("satin ribbon");

    const inputs = hosts.controls.querySelectorAll<HTMLInputElement>("input[type=color]");
    expect(inputs).toHaveLength(7);
    expect(inputs[0]?.getAttribute("aria-label")).toBe("cream roses");
    expect(hosts.controls.querySelector("button")?.textContent).toBe("[ RESET ]");
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    warn.mockRestore();
    error.mockRestore();
    page.destroy();
    for (const host of Object.values(hosts)) host.remove();
  });

  it("persists an edited color and restores the defaults on reset", () => {
    const hosts = { scene: createHost(), legend: createHost(), controls: createHost() };
    const page = mountPage(hosts);

    const input = hosts.controls.querySelector<HTMLInputElement>(
      'input[aria-label="satin ribbon"]',
    );
    expect(input).not.toBeNull();
    if (!input) return;

    input.value = "#ff0000";
    input.dispatchEvent(new Event("input"));

    expect(loadPalette().ribbon).toBe("#ff0000");
    expect(hosts.legend.textContent).toContain("#FF0000");

    const reset = hosts.controls.querySelector<HTMLButtonElement>("button");
    reset?.click();

    expect(localStorage.getItem(PALETTE_STORAGE_KEY)).toBeNull();
    expect(loadPalette().ribbon).toBe(DEFAULT_PALETTE.ribbon);
    expect(input.value.toLowerCase()).toBe(DEFAULT_PALETTE.ribbon.toLowerCase());
    expect(hosts.legend.textContent).toContain(DEFAULT_PALETTE.ribbon.toUpperCase());

    page.destroy();
    for (const host of Object.values(hosts)) host.remove();
  });
});
