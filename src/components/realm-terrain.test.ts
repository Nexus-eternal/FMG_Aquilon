import { describe, expect, it } from "vitest";
import type { GridGraph } from "@/types/GridGraph";
import { applyRealmTerrain, captureRealmTerrain } from "./realm-terrain";

function createGrid(): GridGraph {
  return {
    cells: {
      i: [0, 1],
      h: Uint8Array.from([10, 60]),
      t: Int8Array.from([-1, 1]),
      f: Uint16Array.from([1, 2]),
      temp: Int8Array.from([-5, 12]),
      prec: Uint8Array.from([20, 40])
    },
    features: [
      0,
      { i: 1, land: false, border: true, type: "ocean" },
      { i: 2, land: true, border: false, type: "island" }
    ]
  } as unknown as GridGraph;
}

describe("Realm terrain", () => {
  it("captures and restores mutable terrain without replacing the shared graph", () => {
    const graph = createGrid();
    const originalGraph = graph;
    const terrain = captureRealmTerrain(graph);

    graph.cells.h.fill(0);
    graph.cells.t.fill(0);
    graph.features = [];
    applyRealmTerrain(graph, terrain);

    expect(graph).toBe(originalGraph);
    expect(Array.from(graph.cells.h)).toEqual([10, 60]);
    expect(Array.from(graph.cells.t)).toEqual([-1, 1]);
    expect(graph.features[2].type).toBe("island");
  });

  it("does not retain live feature references", () => {
    const graph = createGrid();
    const terrain = captureRealmTerrain(graph);
    graph.features[2].type = "lake";

    expect(terrain.features[2].type).toBe("island");
  });

  it("rejects terrain created for another grid", () => {
    const graph = createGrid();
    const terrain = captureRealmTerrain(graph);
    terrain.heights.pop();

    expect(() => applyRealmTerrain(graph, terrain)).toThrow("heights has 1 cells, expected 2");
  });
});
