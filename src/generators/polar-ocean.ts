export type PolarOceanFalloff = "linear" | "smoothstep";

export interface PolarOceanOptions {
  widthPercent: number;
  targetHeight?: number;
  falloff?: PolarOceanFalloff;
}

interface PolarOceanGrid {
  points: readonly (readonly [number, number])[];
  height: number;
}

export function applyPolarOcean(
  heights: Uint8Array,
  grid: PolarOceanGrid,
  { widthPercent, targetHeight = 5, falloff = "smoothstep" }: PolarOceanOptions
): Uint8Array {
  const width = grid.height * (clamp(widthPercent, 0, 50) / 100);
  if (!width) return Uint8Array.from(heights);

  const target = clamp(targetHeight, 0, 19);
  const [northEdge, southEdge] = grid.points.reduce(
    ([north, south], point) => [Math.min(north, point[1]), Math.max(south, point[1])],
    [Infinity, -Infinity]
  );

  return Uint8Array.from(heights, (height, index) => {
    const y = grid.points[index]?.[1];
    if (y === undefined) return height;

    const distance = Math.min(y - northEdge, southEdge - y);
    if (distance >= width) return height;

    const progress = clamp(distance / width, 0, 1);
    const blend = falloff === "linear" ? progress : smoothstep(progress);
    return Math.min(height, Math.round(target + (height - target) * blend));
  });
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}
