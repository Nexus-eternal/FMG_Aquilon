import { RealmData } from "@/components/realm-data";
import {
  isInVerticalRange,
  type VerticalCoordinates,
  validateUnderwaterPlacement
} from "@/components/vertical-coordinates";
import type { PackedGraph } from "@/types/PackedGraph";
import type { RouteEnvironment } from "@/types/route-environment";

export const underwaterTools = { enabled: false, depth: 500 };

export function getPlacementDepth(): number | undefined {
  return RealmData.active === "surface" && underwaterTools.enabled ? underwaterTools.depth : undefined;
}

export function isUnderwater(object: VerticalCoordinates & { environment?: RouteEnvironment }): boolean {
  return object.depth !== undefined && (!object.environment || object.environment === "underwater");
}

export function validateBurgCell(graph: PackedGraph, cell: number, depth?: number, burgId?: number): void {
  if (depth !== undefined) validateUnderwaterPlacement(depth, [cell], graph.cells.h);
  else if (!(graph.cells.h[cell] >= 20))
    throw new Error("Surface burgs require land. Choose Underwater in Tools to build in water.");
  if (graph.cells.burg[cell] && graph.cells.burg[cell] !== burgId)
    throw new Error("There is already a burg in this cell.");
}

export function isUnderwaterVisible(
  object: VerticalCoordinates & { environment?: RouteEnvironment; cell?: number; cells?: number[]; points?: number[][] }
): boolean {
  if (!isUnderwater(object)) return true;
  if (RealmData.active !== "surface" || !isInVerticalRange(object.depth!, RealmData.underwater.state.filter))
    return false;
  const cells = object.cell === undefined ? (object.cells ?? object.points?.map(p => p[2]) ?? []) : [object.cell];
  return cells.every(cell => pack.cells.h[cell] < 20);
}

export function validateWaterRoute(points: number[][], depth: number): void {
  validateUnderwaterPlacement(
    depth,
    points.map(p => p[2]),
    pack.cells.h
  );
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(0.5, grid.spacing / 4)));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const cell = Pack.findCell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      if (cell === undefined || !(pack.cells.h[cell] < 20))
        throw new Error("Underwater route crosses land. Add water control points around the coast.");
    }
  }
}
