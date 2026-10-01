import type { PackedGraph } from "@/types/PackedGraph";

export interface VerticalCoordinates {
  altitude?: number; // metres above sea level, independent of heightmap relief
  depth?: number; // metres below sea level
}

export interface VerticalFilter {
  enabled: boolean;
  min: number;
  max: number;
}

export const DEFAULT_SKY_ALTITUDE = 1000;
export const DEFAULT_VERTICAL_FILTER: VerticalFilter = { enabled: false, min: 0, max: 10000 };

export type VerticalObjectKind = "island" | "burg" | "marker" | "route" | "zone";
export interface VerticalObject extends VerticalCoordinates {
  i: number;
  cell?: number;
  firstCell?: number;
  feature?: number;
  cells?: number[] | number;
  points?: number[][];
}

export function validateVerticalValue(value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new Error("Enter a finite, non-negative value in metres.");
}

export function normalizeVerticalFilter(value?: VerticalFilter): VerticalFilter {
  if (!value || !Number.isFinite(value.min) || !Number.isFinite(value.max)) return { ...DEFAULT_VERTICAL_FILTER };
  const min = Math.max(0, value.min);
  return { enabled: Boolean(value.enabled), min, max: Math.max(min, value.max) };
}

export function getAltitude(graph: PackedGraph, object: VerticalObject, kind: VerticalObjectKind): number {
  if (Number.isFinite(object.altitude) && object.altitude! >= 0) return object.altitude!;
  if (kind === "island") return DEFAULT_SKY_ALTITUDE;
  const cell = object.cell ?? (Array.isArray(object.cells) ? object.cells[0] : undefined) ?? object.points?.[0]?.[2];
  const featureId = cell === undefined ? object.feature : graph.cells.f[cell];
  const feature = graph.features?.[featureId ?? -1];
  return feature?.land ? getAltitude(graph, feature, "island") : DEFAULT_SKY_ALTITUDE;
}

export function isInVerticalRange(value: number, filter: VerticalFilter): boolean {
  return !filter.enabled || (value >= filter.min && value <= filter.max);
}

export function validateUnderwaterPlacement(
  depth: number,
  cells: readonly number[],
  surfaceHeights: ArrayLike<number>
): void {
  validateVerticalValue(depth);
  if (!cells.length || cells.some(cell => !Number.isInteger(cell) || cell < 0 || !(surfaceHeights[cell] < 20))) {
    throw new Error("Underwater objects must lie entirely over Surface water cells.");
  }
}
