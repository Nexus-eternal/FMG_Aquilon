import type { GridGraph } from "@/types/GridGraph";
import { minmax } from "@/utils";

interface ScaleHeightmapOptions {
  scale: number;
  borderRatio?: number;
}

/** Scale terrain around the map centre and guarantee an all-water perimeter. */
export function scaleHeightmap(graph: GridGraph, { scale, borderRatio = 0.05 }: ScaleHeightmapOptions): Uint8Array {
  if (!(scale > 0 && scale <= 1)) throw new Error("Heightmap scale must be in the (0, 1] range");
  if (!(borderRatio >= 0 && borderRatio < 0.5)) throw new Error("Heightmap border ratio must be in the [0, 0.5) range");

  const { cellsX, cellsY, cells } = graph;
  const source = cells.h;
  const scaled = new Uint8Array(source.length);
  const centerX = (cellsX - 1) / 2;
  const centerY = (cellsY - 1) / 2;
  const borderX = (cellsX - 1) * borderRatio;
  const borderY = (cellsY - 1) * borderRatio;

  for (let y = 0; y < cellsY; y++) {
    for (let x = 0; x < cellsX; x++) {
      const cellId = y * cellsX + x;
      if (cellId >= source.length || cells.b[cellId]) continue;
      if (x <= borderX || x >= cellsX - 1 - borderX || y <= borderY || y >= cellsY - 1 - borderY) continue;

      const sourceX = (x - centerX) / scale + centerX;
      const sourceY = (y - centerY) / scale + centerY;
      if (sourceX < 0 || sourceX > cellsX - 1 || sourceY < 0 || sourceY > cellsY - 1) continue;

      scaled[cellId] = sample(source, cellsX, cellsY, sourceX, sourceY);
    }
  }

  cells.h = scaled;
  return scaled;
}

function sample(source: Uint8Array, width: number, height: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const dx = x - x0;
  const dy = y - y0;
  const top = source[y0 * width + x0] * (1 - dx) + source[y0 * width + x1] * dx;
  const bottom = source[y1 * width + x0] * (1 - dx) + source[y1 * width + x1] * dx;
  return minmax(Math.round(top * (1 - dy) + bottom * dy), 0, 100);
}
