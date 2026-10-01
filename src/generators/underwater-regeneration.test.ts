import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PackedGraph } from "@/types/PackedGraph";
import "./markers-generator";
import "./zones-generator";

beforeEach(() => {
  globalThis.pack = { zones: [], markers: [] } as unknown as PackedGraph;
});
afterEach(() => vi.restoreAllMocks());

it("retains underwater and locked native markers when regenerating Surface markers", () => {
  pack.markers = [
    { i: 1, cell: 0, x: 0, y: 0, depth: 0 },
    { i: 2, cell: 1, x: 1, y: 1, lock: true },
    { i: 3, cell: 2, x: 2, y: 2 }
  ];
  const generator = Markers as unknown as { generateTypes(): void };
  vi.spyOn(generator, "generateTypes").mockImplementation(() => {});
  Markers.regenerate();
  expect(pack.markers.map(marker => marker.i)).toEqual([1, 2]);
});

it("preserves underwater zones and avoids ID collisions with regenerated Surface zones", () => {
  const underwater = { i: 0, name: "Reef", type: "Preserve", color: "cyan", cells: [1], depth: 500 };
  pack.zones = [underwater];
  vi.spyOn(Zones, "generate").mockImplementation(() => {
    pack.zones = [
      { i: 0, name: "Flood", type: "Flood", color: "blue", cells: [2] },
      { i: 1, name: "Fault", type: "Fault", color: "red", cells: [3] }
    ];
  });
  Zones.regenerate();
  expect(pack.zones[0]).toBe(underwater);
  expect(pack.zones.map(zone => zone.i)).toEqual([0, 1, 2]);
});
