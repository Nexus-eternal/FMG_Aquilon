import { describe, expect, it } from "vitest";
import type { Route } from "@/generators/routes-generator";
import type { Zone } from "@/generators/zones-generator";
import type { PackedGraph } from "@/types/PackedGraph";
import { validateZoneRules, type ZoneRules } from "@/types/zone-rules";
import { getZoneWarnings, paintWorldZone, projectZoneCells, zoneAppliesToRealm } from "./zone-rules";

const rules: ZoneRules = {
  environments: ["surface", "sky", "underwater"],
  severity: "high",
  restricted: true,
  requirements: ["Mask"],
  movement: 0.5
};
const zone = (): Zone => ({
  i: 0,
  name: "Storm",
  type: "Weather",
  color: "#fff",
  cells: [2],
  worldCells: [2],
  rules: structuredClone(rules)
});
const route = (): Pick<Route, "environment" | "altitude" | "depth" | "points"> => ({
  environment: "surface",
  points: [
    [0, 0, 0],
    [40, 0, 4]
  ]
});
const findCell = (x: number) => Math.floor(x / 10);

describe("native hazard zones", () => {
  it("warns about intermediate cells, even if a zone is hidden; never mutates a route", () => {
    const path = route(),
      before = structuredClone(path),
      hazard = zone();
    hazard.hidden = true;
    const warnings = getZoneWarnings(path, [hazard], "surface", findCell, 10);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message.includes("Requires: Mask")).toBe(true);
    expect(warnings[0].message.includes("Movement ×0.5")).toBe(true);
    expect(path).toEqual(before);
  });
  it("respects domain, inclusive vertical bounds and disabled warnings", () => {
    const hazard = zone();
    hazard.rules = { ...rules, environments: ["underwater"], depthMin: 200, depthMax: 500 };
    expect(getZoneWarnings(route(), [hazard], "surface", findCell, 10)).toEqual([]);
    const path = { ...route(), environment: "underwater" as const, depth: 200 };
    expect(getZoneWarnings(path, [hazard], "surface", findCell, 10)).toHaveLength(1);
    path.depth = 501;
    expect(getZoneWarnings(path, [hazard], "surface", findCell, 10)).toEqual([]);
    hazard.rules.enabled = false;
    path.depth = 500;
    expect(getZoneWarnings(path, [hazard], "surface", findCell, 10)).toEqual([]);
    expect(getZoneWarnings({ ...path, environment: "underground" }, [hazard], "surface", findCell, 10)).toEqual([]);
  });
  it("samples the actual air arc rather than just its straight chord", () => {
    const hazard = zone();
    const path = { ...route(), environment: "air" as const, altitude: 1800 };
    expect(getZoneWarnings(path, [hazard], "surface", (x, y) => (x > 15 && x < 25 && y > 2 ? 2 : 9), 5)).toHaveLength(
      1
    );
  });
  it("projects stable world cells into different packed cell IDs without losing invisible coverage", () => {
    const hazard = zone();
    hazard.worldCells = [2, 8];
    const graph = { cells: { i: [0, 1, 2], g: [8, 1, 2] } } as unknown as PackedGraph;
    projectZoneCells(hazard, graph);
    expect(hazard.cells).toEqual([0, 2]);
    graph.cells.g = [1, 2, 3];
    projectZoneCells(hazard, graph);
    expect(hazard.cells).toEqual([1]);
    paintWorldZone(hazard, new Map([[2, [hazard.i]]]), graph);
    expect(hazard.worldCells).toEqual([2, 8, 3]);
    paintWorldZone(hazard, new Map([[1, []]]), graph);
    expect(hazard.worldCells).toEqual([8, 3]);
  });
  it("selects realm visibility independently from warnings and rejects invalid rules", () => {
    const hazard = zone();
    hazard.rules = { ...rules, environments: ["underwater"], enabled: false };
    expect(zoneAppliesToRealm(hazard, "surface")).toBe(true);
    expect(zoneAppliesToRealm(hazard, "sky")).toBe(false);
    expect(() => validateZoneRules({ ...rules, environments: [] })).toThrow();
    expect(() => validateZoneRules({ ...rules, movement: 0 })).toThrow();
    expect(() => validateZoneRules({ ...rules, depthMin: 500, depthMax: 200 })).toThrow();
    expect(() => validateZoneRules({ ...rules, altitudeMax: NaN })).toThrow();
    expect(() => validateZoneRules(rules)).not.toThrow();
  });
});
