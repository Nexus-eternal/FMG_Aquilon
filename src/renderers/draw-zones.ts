import { RealmData } from "@/components/realm-data";
import { isUnderwaterVisible } from "@/components/underwater-native";
import { zoneAppliesToRealm } from "@/components/zone-rules";
import type { Zone } from "@/generators/zones-generator";
import { ensureEl, getVertexPath } from "@/utils";

// not read off the editor's select: the paint editor destroys that dialog mid-redraw (#1810)
export const zonesFilter = { type: "all" };

export function drawZones(): void {
  const { type: filterBy } = zonesFilter;
  const isFiltered = filterBy !== "all";
  const visibleZones = pack.zones.filter(
    zone =>
      !zone.hidden &&
      (zone.worldCells ?? zone.cells).length &&
      (!isFiltered || zone.type === filterBy) &&
      isUnderwaterVisible(zone) &&
      zoneAppliesToRealm(zone, RealmData.active)
  );

  ensureEl("zones").innerHTML = visibleZones.map(drawZone).join("");
}

function drawZone(zone: Zone): string {
  const { i, cells, type, color } = zone;
  const path = zone.worldCells ? getVertexPath(zone.worldCells, grid) : getVertexPath(cells, pack);
  const escapedType = type.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
  return /* html */ `<path id="zone${i}" data-id="${i}" data-type="${escapedType}" d="${path}" fill="${color}" fill-rule="evenodd" />`;
}
