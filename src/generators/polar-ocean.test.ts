import { describe, expect, test } from "vitest";
import { applyPolarOcean } from "./polar-ocean";

const grid = {
  height: 100,
  points: [
    [10, 0],
    [90, 0],
    [10, 5],
    [10, 10],
    [10, 50],
    [10, 90],
    [10, 95],
    [10, 100]
  ] as const
};

describe("applyPolarOcean", () => {
  test("sinks both poles without changing cells outside the configured bands", () => {
    const heights = new Uint8Array(grid.points.length).fill(80);
    const result = applyPolarOcean(heights, grid, { widthPercent: 10, targetHeight: 5 });

    expect(Array.from(result)).toEqual([5, 5, 43, 80, 80, 80, 43, 5]);
    expect(Array.from(heights)).toEqual(new Array(grid.points.length).fill(80));
  });

  test("depends only on latitude and never raises existing terrain", () => {
    const heights = Uint8Array.from([80, 3, 80, 80, 80, 80, 80, 80]);
    const result = applyPolarOcean(heights, grid, { widthPercent: 10, targetHeight: 5, falloff: "linear" });

    expect(result[0]).toBe(5);
    expect(result[1]).toBe(3);
    expect(result[2]).toBe(43);
    expect(result[6]).toBe(43);
  });

  test("clamps the target to water height", () => {
    const result = applyPolarOcean(Uint8Array.from([80, 80, 80, 80, 80, 80, 80, 80]), grid, {
      widthPercent: 10,
      targetHeight: 30
    });

    expect(result[0]).toBe(19);
    expect(result[7]).toBe(19);
  });

  test("guarantees water on the outermost cell rows even when their centers are inset", () => {
    const insetGrid = {
      height: 100,
      points: [
        [10, 5],
        [90, 5],
        [10, 50],
        [10, 95],
        [90, 95]
      ] as const
    };
    const result = applyPolarOcean(new Uint8Array(insetGrid.points.length).fill(80), insetGrid, {
      widthPercent: 1,
      targetHeight: 5
    });

    expect(Array.from(result)).toEqual([5, 5, 80, 5, 5]);
  });
});
