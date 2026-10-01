import type { GridGraph } from "@/types/GridGraph";

export interface RealmTerrainData {
  heights: number[];
  distanceField: number[];
  featureIds: number[];
  temperatures: number[];
  precipitation: number[];
  features: GridGraph["features"];
}

export function captureRealmTerrain(graph: GridGraph): RealmTerrainData {
  return {
    heights: Array.from(graph.cells.h),
    distanceField: Array.from(graph.cells.t),
    featureIds: Array.from(graph.cells.f),
    temperatures: Array.from(graph.cells.temp),
    precipitation: Array.from(graph.cells.prec),
    features: structuredClone(graph.features)
  };
}

export function applyRealmTerrain(graph: GridGraph, terrain: RealmTerrainData): void {
  assertCellCount(graph, terrain);
  graph.cells.h = Uint8Array.from(terrain.heights);
  graph.cells.t = Int8Array.from(terrain.distanceField);
  graph.cells.f = Uint16Array.from(terrain.featureIds);
  graph.cells.temp = Int8Array.from(terrain.temperatures);
  graph.cells.prec = Uint8Array.from(terrain.precipitation);
  graph.features = structuredClone(terrain.features);
}

function assertCellCount(graph: GridGraph, terrain: RealmTerrainData): void {
  const expected = graph.cells.i.length;
  const fields = [
    ["heights", terrain.heights],
    ["distanceField", terrain.distanceField],
    ["featureIds", terrain.featureIds],
    ["temperatures", terrain.temperatures],
    ["precipitation", terrain.precipitation]
  ] as const;

  for (const [name, values] of fields) {
    if (values.length !== expected) {
      throw new Error(`Realm terrain ${name} has ${values.length} cells, expected ${expected}`);
    }
  }
}
