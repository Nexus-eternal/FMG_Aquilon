import { describe, expect, it } from "vitest";
import type { PackedGraph } from "@/types/PackedGraph";
import {
  getAltitude,
  isInVerticalRange,
  normalizeVerticalFilter,
  validateUnderwaterPlacement,
  validateVerticalValue
} from "./vertical-coordinates";

const graph = {
  cells: { f: [1, 1, 0] },
  features: [0, { i: 1, land: true, altitude: 3200 }]
} as unknown as PackedGraph;

describe("vertical coordinates", () => {
  it("inherits island altitude while preserving explicit zero and overrides", () => {
    expect(getAltitude(graph, { i: 2, cell: 0 }, "burg")).toBe(3200);
    expect(getAltitude(graph, { i: 2, cell: 0, altitude: 0 }, "marker")).toBe(0);
    expect(getAltitude(graph, { i: 2, cells: [1, 2] }, "zone")).toBe(3200);
    expect(
      getAltitude(
        graph,
        {
          i: 2,
          points: [
            [0, 0, 0],
            [1, 1, 2]
          ]
        },
        "route"
      )
    ).toBe(3200);
    expect(getAltitude(graph, { i: 2, cell: 2 }, "marker")).toBe(1000);
  });

  it("treats interval endpoints inclusively and disabled filtering as all heights", () => {
    const filter = { enabled: true, min: 1000, max: 2000 };
    expect([0, 1000, 2000, 2001].map(value => isInVerticalRange(value, filter))).toEqual([false, true, true, false]);
    expect(isInVerticalRange(99999, { ...filter, enabled: false })).toBe(true);
    expect(normalizeVerticalFilter({ enabled: true, min: -10, max: -20 })).toEqual({ enabled: true, min: 0, max: 0 });
    expect(normalizeVerticalFilter({ enabled: true, min: NaN, max: Infinity }).enabled).toBe(false);
  });

  it("rejects invalid values and underwater coverage over land or missing cells", () => {
    for (const invalid of [-1, NaN, Infinity]) expect(() => validateVerticalValue(invalid)).toThrow();
    expect(() => validateUnderwaterPlacement(200, [0, 1], [0, 19, 20])).not.toThrow();
    for (const cells of [[], [0, 2], [3], [-1], [0.5]]) {
      expect(() => validateUnderwaterPlacement(200, cells, [0, 19, 20])).toThrow("Surface water cells");
    }
  });
});
