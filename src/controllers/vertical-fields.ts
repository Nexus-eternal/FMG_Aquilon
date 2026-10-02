import { Layers } from "@/components/layers";
import { RealmData } from "@/components/realm-data";
import { tip } from "@/components/tooltips";
import {
  type VerticalCoordinates,
  validateUnderwaterPlacement,
  validateVerticalValue
} from "@/components/vertical-coordinates";
import { ensureEl } from "@/utils";

/** Shared fields inside the native entity editors, not a separate entity editor. */
export function appendDepthFields(
  parentId: string,
  object: VerticalCoordinates,
  cells: () => number[],
  onChange?: () => void
): void {
  if (RealmData.active !== "surface") return;
  const prefix = `${parentId}Vertical`;
  ensureEl(parentId).insertAdjacentHTML(
    "beforeend",
    `<div><label for="${prefix}Domain" class="label">Environment:</label><select id="${prefix}Domain"><option value="surface">Surface</option><option value="underwater">Underwater</option></select></div><div><label for="${prefix}Depth" class="label">Depth (m):</label><input id="${prefix}Depth" type="number" min="0" step="100" style="width:9em" /></div>`
  );
  const domain = ensureEl<HTMLSelectElement>(`${prefix}Domain`);
  const depth = ensureEl<HTMLInputElement>(`${prefix}Depth`);
  const refresh = () => {
    domain.value = object.depth === undefined ? "surface" : "underwater";
    depth.value = String(object.depth ?? 500);
    depth.disabled = object.depth === undefined;
  };
  const apply = () => {
    const oldDepth = object.depth;
    try {
      if (domain.value === "underwater") {
        const value = depth.valueAsNumber;
        const footprint = cells();
        if (footprint.length) validateUnderwaterPlacement(value, footprint, pack.cells.h);
        else validateVerticalValue(value);
        object.depth = value;
      } else delete object.depth;
      onChange?.();
      Layers.draw("burgIcons", "labels", "markers", "routes", "zones", "emblems");
    } catch (error) {
      if (oldDepth === undefined) delete object.depth;
      else object.depth = oldDepth;
      tip((error as Error).message, false, "error");
    }
    refresh();
  };
  domain.addEventListener("change", apply);
  depth.addEventListener("change", apply);
  depth.addEventListener("input", () => {
    if (depth.value !== "" && depth.validity.valid) apply();
  });
  refresh();
}
