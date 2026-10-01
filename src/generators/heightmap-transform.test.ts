import { describe, expect, test } from "vitest";
import type { GridGraph } from "@/types/GridGraph";
import { scaleHeightmap } from "./heightmap-transform";

function graph(size: number, heights: number[]): GridGraph {
  const length = size * size;
  return {
    cellsX: size,
    cellsY: size,
    points: Array.from({ length }, (_, index) => [index % size, Math.floor(index / size)]),
    cells: {
      i: Array.from({ length }, (_, index) => index),
      b: Array.from({ length }, (_, index) => {
        const x = index % size;
        const y = Math.floor(index / size);
        return x === 0 || y === 0 || x === size - 1 || y === size - 1;
      }),
      h: Uint8Array.from(heights)
    }
  } as unknown as GridGraph;
}

describe("scaleHeightmap", () => {
  test("shrinks terrain around the centre and clears the complete perimeter", () => {
    const source = graph(7, Array(49).fill(30));
    const heights = scaleHeightmap(source, { scale: 0.4, borderRatio: 0.1 });

    expect(heights[3 * 7 + 3]).toBe(30);
    expect(source.cells.i.filter(cellId => source.cells.b[cellId]).every(cellId => heights[cellId] < 20)).toBe(true);
    expect(Array.from(heights).filter(height => height >= 20)).toHaveLength(9);
  });

  test("rejects transforms that cannot guarantee a bounded map", () => {
    const source = graph(3, Array(9).fill(30));
    expect(() => scaleHeightmap(source, { scale: 0 })).toThrow(/scale/);
    expect(() => scaleHeightmap(source, { scale: 0.5, borderRatio: 0.5 })).toThrow(/border/);
  });
});
