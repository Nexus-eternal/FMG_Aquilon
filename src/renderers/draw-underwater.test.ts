import { describe, expect, it } from "vitest";
import type { GridGraph } from "@/types/GridGraph";
import { underwaterRoutePoints } from "./draw-underwater";

describe("Underwater route geometry", () => {
  it("crosses through shared edge midpoints, keeping each segment inside its water cell", () => {
    const graph = {
      points: [
        [5, 5],
        [15, 5]
      ],
      cells: {
        v: [
          [0, 1, 2, 3],
          [1, 4, 5, 2]
        ]
      },
      vertices: {
        p: [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [20, 0],
          [20, 10]
        ]
      }
    } as unknown as GridGraph;
    expect(underwaterRoutePoints([0, 1], graph)).toEqual([
      [5, 5],
      [10, 5],
      [15, 5]
    ]);
    expect(() => underwaterRoutePoints([0, 0], graph)).toThrow(/shared Voronoi edge/);
  });
});
