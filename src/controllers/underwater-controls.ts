import { Layers } from "@/components/layers";
import { stopMapPlacement } from "@/components/map-placement";
import { RealmData } from "@/components/realm-data";
import { tip } from "@/components/tooltips";
import { underwaterTools } from "@/components/underwater-native";
import { validateVerticalValue } from "@/components/vertical-coordinates";
import { ensureEl } from "@/utils";

export function installUnderwaterControls(): void {
  const environment = ensureEl<HTMLSelectElement>("toolsEnvironment");
  const depth = ensureEl<HTMLInputElement>("toolsDepth");
  environment.addEventListener("change", () => {
    stopMapPlacement();
    underwaterTools.enabled = environment.value === "underwater";
    depth.disabled = !underwaterTools.enabled;
    if (underwaterTools.enabled) {
      Layers.show("burgIcons", "labels", "routes", "markers", "states");
      window.dispatchEvent(new Event("underwater:focus"));
    }
  });
  depth.addEventListener("change", () => {
    try {
      validateVerticalValue(depth.valueAsNumber);
      underwaterTools.depth = depth.valueAsNumber;
    } catch (error) {
      depth.value = String(underwaterTools.depth);
      tip((error as Error).message, false, "error");
    }
  });
  const panel = document.createElement("details");
  depth.addEventListener("input", () => {
    if (depth.value !== "" && depth.validity.valid) underwaterTools.depth = depth.valueAsNumber;
  });
  panel.id = "underwaterDisplay";
  panel.innerHTML =
    '<summary>Underwater visibility</summary><label><input id="underwaterDepthFilter" type="checkbox" class="native" /> Filter depth</label><label> From <input id="underwaterDepthMin" type="number" min="0" value="0" style="width:6em" /> m</label><label> To <input id="underwaterDepthMax" type="number" min="0" value="10000" style="width:6em" /> m</label><p id="underwaterMigrationStatus" role="status"></p>';
  ensureEl("layersContent").prepend(panel);
  const refresh = () => {
    const filter = RealmData.underwater.state.filter;
    ensureEl<HTMLInputElement>("underwaterDepthFilter").checked = filter.enabled;
    ensureEl<HTMLInputElement>("underwaterDepthMin").value = String(filter.min);
    ensureEl<HTMLInputElement>("underwaterDepthMax").value = String(filter.max);
    environment.disabled = RealmData.active !== "surface";
    depth.disabled = environment.disabled || !underwaterTools.enabled;
  };
  for (const id of ["underwaterDepthFilter", "underwaterDepthMin", "underwaterDepthMax"])
    ensureEl(id).addEventListener("change", () => {
      try {
        RealmData.underwater.setFilter({
          enabled: ensureEl<HTMLInputElement>("underwaterDepthFilter").checked,
          min: ensureEl<HTMLInputElement>("underwaterDepthMin").valueAsNumber,
          max: ensureEl<HTMLInputElement>("underwaterDepthMax").valueAsNumber
        });
        Layers.draw("burgIcons", "labels", "routes", "markers", "zones", "emblems");
      } catch (error) {
        tip((error as Error).message, false, "error");
      }
      refresh();
    });
  for (const event of ["realm:changed", "map:loaded", "map:generated"]) window.addEventListener(event, refresh);
  refresh();
}
