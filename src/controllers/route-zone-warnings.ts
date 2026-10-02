import { RealmData } from "@/components/realm-data";
import { getZoneWarnings } from "@/components/zone-rules";
import type { Route } from "@/generators/routes-generator";
import { ensureEl, findEl } from "@/utils";

export function showRouteZoneWarnings(
  parentId: string,
  route: Pick<Route, "environment" | "altitude" | "depth" | "points">
): void {
  const parent = findEl(parentId);
  if (!parent) return;
  const id = `${parentId}ZoneWarnings`;
  let root = findEl(id);
  if (!root) {
    root = document.createElement("div");
    root.id = id;
    root.setAttribute("role", "status");
    root.style.cssText =
      "max-width:30em;margin:.6em 0;padding:.5em;border:1px solid #b58b39;border-radius:.3em;background:#fff5d5;color:#543c19";
    parent.append(root);
  }
  const world = pack.zones.filter(zone => zone.worldCells);
  const local = pack.zones.filter(zone => !zone.worldCells);
  const warnings = [
    ...getZoneWarnings(route, world, RealmData.active, (x, y) => Grid.findCell(x, y), grid.spacing),
    ...getZoneWarnings(route, local, RealmData.active, (x, y) => Pack.findCell(x, y), grid.spacing)
  ];
  root.hidden = !warnings.length;
  root.dataset.count = String(warnings.length);
  root.replaceChildren();
  if (!warnings.length) return;
  const title = document.createElement("strong");
  title.textContent = "Zone warnings — route remains allowed";
  root.append(title);
  for (const warning of warnings) {
    const paragraph = document.createElement("div");
    paragraph.textContent = warning.message;
    root.append(paragraph);
  }
  ensureEl(id).dataset.count = String(warnings.length);
}
