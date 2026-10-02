import { beforeEach, expect, it, vi } from "vitest";
import { RealmData } from "@/components/realm-data";
import { migrateUnderwaterAnnotations } from "@/generators/underwater-migration";
import type { PackedGraph } from "@/types/PackedGraph";

beforeEach(() => {
  RealmData.reset();
  globalThis.grid = {
    points: [
      [1, 1],
      [11, 1]
    ],
    spacing: 10
  } as typeof grid;
  globalThis.pack = {
    cells: {
      h: [5, 5],
      burg: [0, 0],
      state: [0, 0],
      f: [1, 1],
      p: [
        [1, 1],
        [11, 1]
      ],
      routes: {}
    },
    burgs: [{ i: 0 }],
    states: [{ i: 0, name: "Neutrals" }],
    markers: [],
    zones: [],
    routes: [],
    addedLabels: [],
    features: []
  } as unknown as PackedGraph;
  vi.stubGlobal("Pack", { findCell: (x: number) => (x < 6 ? 0 : 1) });
  vi.stubGlobal("Burgs", {
    add: ([x, y]: number[], placement: { depth: number }) => {
      const cell = x < 6 ? 0 : 1;
      if (pack.cells.burg[cell]) throw new Error("Cell occupied");
      const i = pack.burgs.length;
      pack.burgs.push({
        i,
        cell,
        x,
        y,
        depth: placement.depth,
        state: 0,
        population: 1,
        culture: 0,
        coa: {}
      } as (typeof pack.burgs)[number]);
      pack.cells.burg[cell] = i;
      return i;
    },
    changeGroup: vi.fn()
  });
  vi.stubGlobal("Markers", { add: (marker: (typeof pack.markers)[number]) => pack.markers.push(marker) });
  vi.stubGlobal("Routes", { getNextId: () => pack.routes.length });
  vi.stubGlobal("States", { collectStatistics: vi.fn(), getPoles: vi.fn() });
});

it("migrates native entities and membership once, keeping depth filter", () => {
  RealmData.underwater.restore({
    version: 1,
    filter: { enabled: true, min: 0, max: 1000 },
    entities: [
      { i: 0, kind: "settlement", name: "City", cells: [0], depth: 500, factionId: 1 },
      { i: 1, kind: "faction", name: "Pearl League", cells: [0], depth: 500 },
      { i: 2, kind: "route", name: "Route", cells: [0, 1], depth: 500 },
      { i: 3, kind: "zone", name: "Zone", cells: [1], depth: 800 },
      { i: 4, kind: "marker", name: "Marker", cells: [1], depth: 0 }
    ]
  });
  expect(migrateUnderwaterAnnotations()).toBe(5);
  expect(pack.burgs[1]).toMatchObject({ name: "City", state: 1, depth: 500, capital: 1 });
  expect(pack.states[1]).toMatchObject({ name: "Pearl League", environment: "underwater", capital: 1 });
  expect(pack.routes[0]).toMatchObject({ name: "Route", depth: 500 });
  expect(pack.markers[0].depth).toBe(0);
  expect(pack.zones[0].depth).toBe(800);
  expect(RealmData.underwater.state.entities).toEqual([]);
  expect(RealmData.underwater.state.filter.max).toBe(1000);
  expect(migrateUnderwaterAnnotations()).toBe(0);
});

it("rolls back the entire migration when two old cities map to one native cell", () => {
  RealmData.underwater.restore({
    version: 1,
    filter: { enabled: false, min: 0, max: 10000 },
    entities: [
      { i: 0, kind: "settlement", name: "First", cells: [0], depth: 500 },
      { i: 1, kind: "settlement", name: "Second", cells: [0], depth: 800 }
    ]
  });
  const old = structuredClone(pack);
  expect(() => migrateUnderwaterAnnotations()).toThrow(/occupied/);
  expect(pack).toEqual(old);
  expect(RealmData.underwater.state.entities).toHaveLength(2);
});
