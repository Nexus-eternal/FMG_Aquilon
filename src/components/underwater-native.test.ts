import { beforeEach, describe, expect, it, vi } from "vitest";
import { RealmData } from "@/components/realm-data";
import {
  getPlacementDepth,
  isUnderwaterVisible,
  underwaterTools,
  validateBurgCell,
  validateWaterRoute
} from "@/components/underwater-native";
import type { PackedGraph } from "@/types/PackedGraph";

beforeEach(() => {
  RealmData.reset();
  underwaterTools.enabled = false;
  underwaterTools.depth = 500;
  globalThis.pack = { cells: { h: [5, 5, 25], burg: [0, 7, 0] } } as unknown as PackedGraph;
  globalThis.grid = { spacing: 2 } as typeof grid;
  vi.stubGlobal("Pack", { findCell: (x: number) => (x < 0 || x > 20 ? 2 : x < 10 ? 0 : 1) });
});

describe("native Underwater integration", () => {
  it("keeps native one-burg-per-cell and water/land placement rules", () => {
    expect(() => validateBurgCell(pack, 0)).toThrow(/Surface burgs require land/);
    expect(() => validateBurgCell(pack, 0, 0)).not.toThrow();
    expect(() => validateBurgCell(pack, 1, 500)).toThrow(/already a burg/);
    expect(() => validateBurgCell(pack, 1, 500, 7)).not.toThrow();
    expect(() => validateBurgCell(pack, 2, 500)).toThrow(/Surface water/);
    expect(() => validateBurgCell(pack, 0, -1)).toThrow();
  });
  it("creation context applies only to Surface, never to Sky", () => {
    expect(getPlacementDepth()).toBeUndefined();
    underwaterTools.enabled = true;
    expect(getPlacementDepth()).toBe(500);
    RealmData.setActive("sky");
    expect(getPlacementDepth()).toBeUndefined();
  });
  it("filters native objects without modifying them and quarantines land", () => {
    const burg = { cell: 0, depth: 1500 };
    RealmData.underwater.setFilter({ enabled: true, min: 0, max: 1000 });
    expect(isUnderwaterVisible(burg)).toBe(false);
    expect(isUnderwaterVisible({ cell: 2 })).toBe(true);
    RealmData.underwater.setFilter({ enabled: false, min: 0, max: 1000 });
    expect(isUnderwaterVisible(burg)).toBe(true);
    expect(isUnderwaterVisible({ cell: 2, depth: 500 })).toBe(false);
    expect(burg).toEqual({ cell: 0, depth: 1500 });
  });
  it("validates the route interior, not only its water endpoints", () => {
    expect(() =>
      validateWaterRoute(
        [
          [1, 0, 0],
          [19, 0, 1]
        ],
        0
      )
    ).not.toThrow();
    vi.stubGlobal("Pack", { findCell: (x: number) => (x > 8 && x < 12 ? 2 : 0) });
    expect(() =>
      validateWaterRoute(
        [
          [1, 0, 0],
          [19, 0, 1]
        ],
        1000
      )
    ).toThrow(/crosses land/);
  });
});
