import { RealmData } from "@/components/realm-data";
import {
  getAltitude,
  type VerticalObject,
  type VerticalObjectKind,
  validateVerticalValue
} from "@/components/vertical-coordinates";
import { drawVerticalFilter } from "@/renderers/draw-vertical-filter";
import { ensureEl, escapeHtml } from "@/utils";

type Entry = { kind: VerticalObjectKind; object: VerticalObject; name: string };
let entries: Entry[] = [];
let onChange = (): void => undefined;

export function installVerticalCoordinatesEditor(parent: HTMLElement, changed: () => void): void {
  onChange = changed;
  const panel = document.createElement("details");
  panel.id = "realmVerticalPanel";
  panel.innerHTML = /* html */ `<summary>Sky altitude (metres)</summary>
    <div id="realmVerticalBody">
      <p>Island altitude is inherited by its settlements and points of interest. Empty altitude = inherit; islands default to 1000 m.</p>
      <label>Object <select id="realmVerticalObject" style="width:100%"></select></label>
      <label>Altitude <input id="realmVerticalAltitude" type="number" min="0" step="100" style="width:7em" /> m</label>
      <button id="realmVerticalRefresh" type="button">Refresh objects</button>
      <p id="realmVerticalError" role="status"></p>
      <label><input id="realmVerticalEnabled" type="checkbox" class="native" /> Filter altitude</label>
      <label class="realm-demo-slider">From <input id="realmVerticalMin" type="range" min="0" max="10000" step="100" /><output></output></label>
      <label class="realm-demo-slider">To <input id="realmVerticalMax" type="range" min="0" max="10000" step="100" /><output></output></label>
      <p>Filtering changes visibility only. Disable it to edit hidden objects. Surface and clouds remain visible.</p>
    </div>
    <p id="realmVerticalHint">Enter Sky to edit altitude.</p>`;
  parent.append(panel);
  ensureEl("realmVerticalObject").addEventListener("change", showSelectedAltitude);
  ensureEl("realmVerticalAltitude").addEventListener("input", changeAltitude);
  ensureEl("realmVerticalRefresh").addEventListener("click", refreshVerticalCoordinatesEditor);
  for (const id of ["realmVerticalEnabled", "realmVerticalMin", "realmVerticalMax"]) {
    ensureEl(id).addEventListener("input", changeFilter);
  }
  refreshVerticalCoordinatesEditor();
}

export function refreshVerticalCoordinatesEditor(): void {
  if (!document.getElementById("realmVerticalPanel")) return;
  const sky = RealmData.active === "sky";
  ensureEl("realmVerticalBody").hidden = !sky;
  ensureEl("realmVerticalHint").hidden = sky;
  if (!sky) return;
  entries = [];
  const add = (kind: VerticalObjectKind, objects: (VerticalObject & { name?: string; removed?: boolean })[]) => {
    for (const object of objects) {
      if (!object || object.removed || (kind === "burg" && !object.i)) continue;
      entries.push({ kind, object, name: `${kind}: ${object.name || `#${object.i}`}` });
    }
  };
  add(
    "island",
    pack.features.filter(feature => feature?.land)
  );
  add("burg", pack.burgs);
  add("marker", pack.markers);
  add("route", pack.routes);
  add("zone", pack.zones);
  const select = ensureEl<HTMLSelectElement>("realmVerticalObject");
  const previous = select.value;
  select.innerHTML = entries
    .map(({ kind, object, name }) => `<option value="${kind}:${object.i}">${escapeHtml(name)}</option>`)
    .join("");
  if (entries.some(entry => `${entry.kind}:${entry.object.i}` === previous)) select.value = previous;
  showSelectedAltitude();
  showFilter();
}

function selectedEntry(): Entry | undefined {
  const value = ensureEl<HTMLSelectElement>("realmVerticalObject").value;
  return entries.find(entry => `${entry.kind}:${entry.object.i}` === value);
}

function showSelectedAltitude(): void {
  const entry = selectedEntry();
  const input = ensureEl<HTMLInputElement>("realmVerticalAltitude");
  input.disabled = !entry;
  input.value = entry?.object.altitude === undefined ? "" : String(entry.object.altitude);
  input.placeholder = entry ? String(getAltitude(pack, entry.object, entry.kind)) : "";
  ensureEl("realmVerticalError").textContent = "";
}

function changeAltitude(): void {
  const entry = selectedEntry();
  if (!entry || RealmData.active !== "sky") return;
  const input = ensureEl<HTMLInputElement>("realmVerticalAltitude");
  try {
    if (input.value === "") delete entry.object.altitude;
    else {
      validateVerticalValue(input.valueAsNumber);
      entry.object.altitude = input.valueAsNumber;
    }
    ensureEl("realmVerticalError").textContent = "";
    showFilter();
    drawVerticalFilter();
    onChange();
  } catch (error) {
    ensureEl("realmVerticalError").textContent = error instanceof Error ? error.message : "Invalid altitude";
  }
}

function changeFilter(event: Event): void {
  if (RealmData.active !== "sky") return;
  let min = Number(ensureEl<HTMLInputElement>("realmVerticalMin").value);
  let max = Number(ensureEl<HTMLInputElement>("realmVerticalMax").value);
  if (min > max) {
    if ((event.target as HTMLElement).id === "realmVerticalMin") max = min;
    else min = max;
  }
  RealmData.setVerticalFilter("sky", { enabled: ensureEl<HTMLInputElement>("realmVerticalEnabled").checked, min, max });
  showFilter();
  drawVerticalFilter();
  onChange();
}

function showFilter(): void {
  const filter = RealmData.getVerticalFilter("sky");
  const maximum =
    Math.ceil(Math.max(10000, filter.max, ...entries.map(entry => getAltitude(pack, entry.object, entry.kind))) / 100) *
    100;
  ensureEl<HTMLInputElement>("realmVerticalEnabled").checked = filter.enabled;
  for (const [id, value] of [
    ["realmVerticalMin", filter.min],
    ["realmVerticalMax", filter.max]
  ] as const) {
    const input = ensureEl<HTMLInputElement>(id);
    input.max = String(maximum);
    input.value = String(value);
    const output = input.parentElement?.querySelector("output");
    if (output) output.value = `${value} m`;
  }
}
