// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RealmData } from "@/components/realm-data";
import { drawUnderwater } from "@/renderers/draw-underwater";
import type { GridGraph } from "@/types/GridGraph";
import { installUnderwaterEditor, refreshUnderwaterEditor } from "./underwater-editor";

const layerState = vi.hoisted(() => ({ active: [] as string[], locked: false }));
vi.mock("@/components/layers", () => ({
  Layers: {
    register: () => ({ getEl: () => document.getElementById("underwaterObjects") }),
    createGroup: vi.fn(),
    setGroupVisibility: vi.fn(),
    getGroup: () => ({ locked: layerState.locked }),
    get state() {
      return { active: layerState.active };
    },
    set: (active: string[]) => {
      layerState.active = active;
    }
  }
}));

function input(id: string, value: string): void {
  (document.getElementById(id) as HTMLInputElement).value = value;
}
function click(id: string): void {
  document.getElementById(id)!.click();
}
function mapClick(x: number, y: number): void {
  document.getElementById("viewbox")!.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }));
}

beforeEach(() => {
  document.body.innerHTML =
    '<div id="layersContent"></div><svg id="map"><g id="viewbox"><g id="underwaterObjects"/></g></svg>';
  globalThis.grid = {
    points: [
      [5, 5],
      [15, 5],
      [25, 5]
    ],
    cells: {
      h: Uint8Array.from([5, 5, 20]),
      c: [[1], [0, 2], [1]],
      v: [
        [0, 1, 2, 3],
        [1, 4, 5, 2],
        [4, 6, 7, 5]
      ]
    },
    vertices: {
      p: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [20, 0],
        [20, 10],
        [30, 0],
        [30, 10]
      ]
    }
  } as unknown as GridGraph;
  layerState.active = [];
  layerState.locked = false;
  RealmData.reset();
  installUnderwaterEditor();
});

describe("Underwater editor and rendering", () => {
  it("keeps placement working when map loading replaces the SVG", () => {
    document.getElementById("map")!.outerHTML = '<svg id="map"><g id="viewbox"><g id="underwaterObjects"/></g></svg>';
    input("underwaterKind", "marker");
    input("underwaterDepth", "0");
    click("underwaterAdd");
    mapClick(5, 5);
    expect(RealmData.underwater.get(0)?.depth).toBe(0);
    expect(document.getElementById("underwater-0")).not.toBeNull();
  });

  it("creates on water, edits, moves, deletes, and rejects land without losing the draft", () => {
    input("underwaterName", "Abyssal city");
    click("underwaterAdd");
    mapClick(25, 5);
    expect(document.getElementById("underwaterStatus")?.textContent).toMatch(/Land is not allowed/);
    expect(RealmData.underwater.state.entities).toHaveLength(0);
    mapClick(5, 5);
    expect(RealmData.underwater.get(0)?.cells).toEqual([0]);
    expect(document.getElementById("underwater-0")?.textContent).toContain("Abyssal city");
    input("underwaterDepth", "1500");
    click("underwaterApply");
    expect(RealmData.underwater.get(0)?.depth).toBe(1500);
    click("underwaterMove");
    mapClick(15, 5);
    expect(RealmData.underwater.get(0)?.cells).toEqual([1]);
    click("underwaterDelete");
    expect(RealmData.underwater.state.entities).toEqual([]);
  });

  it("paints a zone, cancels drafts, filters without deletion and restores serialized UI state", () => {
    input("underwaterKind", "zone");
    click("underwaterAdd");
    mapClick(5, 5);
    mapClick(15, 5);
    expect(document.getElementById("underwaterDraft")).not.toBeNull();
    click("underwaterFinish");
    expect(RealmData.underwater.get(0)?.cells).toEqual([0, 1]);
    input("underwaterDepth", "2500");
    click("underwaterApply");
    input("underwaterMax", "1000");
    document.getElementById("underwaterMax")!.dispatchEvent(new Event("input"));
    (document.getElementById("underwaterFilter") as HTMLInputElement).checked = true;
    document.getElementById("underwaterFilter")!.dispatchEvent(new Event("input"));
    expect(document.getElementById("underwater-0")).toBeNull();
    const saved = JSON.parse(JSON.stringify(RealmData.state));
    RealmData.reset();
    RealmData.restore(saved);
    refreshUnderwaterEditor();
    expect((document.getElementById("underwaterDepth") as HTMLInputElement).value).toBe("2500");
    expect((document.getElementById("underwaterMax") as HTMLInputElement).value).toBe("1000");
    expect(RealmData.underwater.state.entities).toHaveLength(1);
    click("underwaterAdd");
    mapClick(5, 5);
    click("underwaterCancel");
    expect(document.getElementById("underwaterDraft")).toBeNull();
    expect(RealmData.underwater.state.entities).toHaveLength(1);
  });

  it("blocks invalid depth and domain locks and hides controls and content in Sky", () => {
    click("underwaterAdd");
    mapClick(5, 5);
    input("underwaterDepth", "-1");
    click("underwaterApply");
    expect(RealmData.underwater.get(0)?.depth).toBe(500);
    layerState.locked = true;
    click("underwaterDelete");
    expect(document.getElementById("underwaterStatus")?.textContent).toMatch(/Unlock/);
    expect(RealmData.underwater.state.entities).toHaveLength(1);
    RealmData.setActive("sky");
    refreshUnderwaterEditor();
    drawUnderwater({ getEl: () => document.getElementById("underwaterObjects")! } as never);
    expect(document.getElementById("underwaterBody")?.hidden).toBe(true);
    expect(document.getElementById("underwaterObjects")?.children).toHaveLength(0);
    mapClick(15, 5);
    expect(RealmData.underwater.get(0)?.cells).toEqual([0]);
  });
});
