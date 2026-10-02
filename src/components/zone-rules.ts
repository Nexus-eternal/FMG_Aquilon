import type { Route } from "@/generators/routes-generator";
import type { Zone } from "@/generators/zones-generator";
import type { PackedGraph } from "@/types/PackedGraph";
import { getRouteEnvironment } from "@/types/route-environment";
import type { ZoneEnvironment } from "@/types/zone-rules";

export function zoneAppliesToRealm(zone: Zone, realm: string): boolean {
  if (!zone.rules) return true;
  const environments = zone.rules.environments;
  return realm === "sky" ? environments.includes("sky") : environments.some(env => env !== "sky");
}

export function projectZoneCells(zone: Zone, graph: PackedGraph): void {
  if (!zone.worldCells) return;
  const footprint = new Set(zone.worldCells);
  zone.cells = graph.cells.i.filter(cell => footprint.has(graph.cells.g[cell]));
}

export function paintWorldZone(zone: Zone, changes: ReadonlyMap<number, readonly number[]>, graph: PackedGraph): void {
  if (!zone.worldCells) return;
  const footprint = new Set(zone.worldCells);
  for (const [cell, zoneIds] of changes) {
    const source = graph.cells.g[cell];
    if (zoneIds.includes(zone.i)) footprint.add(source);
    else footprint.delete(source);
  }
  zone.worldCells = [...footprint];
  projectZoneCells(zone, graph);
}

export interface ZoneWarning {
  zone: Zone;
  message: string;
}

export function getZoneWarnings(
  route: Pick<Route, "environment" | "altitude" | "depth" | "points">,
  zones: readonly Zone[],
  realm: string,
  findCell: (x: number, y: number) => number | undefined,
  spacing: number
): ZoneWarning[] {
  const environment = getRouteEnvironment(route);
  if (environment === "underground") return [];
  const domain: ZoneEnvironment =
    environment === "air" || realm === "sky" ? "sky" : environment === "underwater" ? "underwater" : "surface";
  const hits = new Set<number>();
  const points = route.points;
  const visit = (x: number, y: number) => {
    const cell = findCell(x, y);
    if (cell !== undefined) hits.add(cell);
  };
  if (points.length === 1) visit(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i - 1];
    const [endX, endY] = points[i];
    const dx = endX - x,
      dy = endY - y,
      length = Math.hypot(dx, dy);
    const bend = environment === "air" ? Math.min(40, length * 0.12) : 0;
    const controlX = (x + endX) / 2 - (dy / (length || 1)) * bend;
    const controlY = (y + endY) / 2 + (dx / (length || 1)) * bend;
    const steps = Math.max(1, Math.ceil((length + 2 * bend) / Math.max(0.5, spacing / 4)));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps,
        u = 1 - t;
      visit(u * u * x + 2 * u * t * controlX + t * t * endX, u * u * y + 2 * u * t * controlY + t * t * endY);
    }
  }
  return zones.flatMap(zone => {
    const rules = zone.rules;
    if (
      !rules ||
      rules.enabled === false ||
      !rules.environments.includes(domain) ||
      !(zone.worldCells ?? zone.cells).some(cell => hits.has(cell))
    )
      return [];
    const value = domain === "sky" ? route.altitude : domain === "underwater" ? route.depth : undefined;
    const min = domain === "sky" ? rules.altitudeMin : domain === "underwater" ? rules.depthMin : undefined;
    const max = domain === "sky" ? rules.altitudeMax : domain === "underwater" ? rules.depthMax : undefined;
    if (value !== undefined && ((min !== undefined && value < min) || (max !== undefined && value > max))) return [];
    const messages = [`${zone.name}: ${rules.severity} hazard`];
    if (rules.restricted) messages.push("Restricted passage (advisory)");
    if (rules.requirements.length) messages.push(`Requires: ${rules.requirements.join(", ")}`);
    if (rules.movement !== 1) messages.push(`Movement ×${rules.movement}`);
    if (value === undefined && (min !== undefined || max !== undefined))
      messages.push("Height/depth unknown; check the zone range");
    return [{ zone, message: messages.join(" · ") }];
  });
}
