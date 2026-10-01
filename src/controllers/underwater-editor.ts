import { pointer } from "d3";
import { type Layer, Layers } from "@/components/layers";
import { RealmData } from "@/components/realm-data";
import type { UnderwaterEntity, UnderwaterEntityKind } from "@/components/underwater-domain";
import { drawUnderwater, UNDERWATER_GROUP, UNDERWATER_LAYER } from "@/renderers/draw-underwater";
import { ensureEl, escapeHtml } from "@/utils";
import { findPath } from "@/utils/pathUtils";

let selected: number | undefined;
let draft: UnderwaterEntity | undefined;
let underwaterLayer: Layer;

export function installUnderwaterEditor(): void {
  if (document.getElementById("underwaterPanel")) return;
  underwaterLayer = Layers.register(
    { id: UNDERWATER_LAYER, parent: "viewbox", metadata: { title: "Underwater objects" }, draw: drawUnderwater },
    { before: "rulers" }
  );
  Layers.createGroup({ id: UNDERWATER_GROUP, title: "Underwater domain", layers: [UNDERWATER_LAYER], visible: true });
  const panel = document.createElement("details");
  panel.id = "underwaterPanel";
  panel.innerHTML = /* html */ `<summary>Underwater — depth editor</summary>
    <style>#underwaterBody label{display:block;margin:4px 0}#underwaterStatus{margin:6px 0;line-height:1.3}</style>
    <p id="underwaterStatus" role="status"></p>
    <div id="underwaterBody" style="max-height:360px;overflow:auto">
      <p>Objects snap to Surface water cells. Click a map object to select it.</p>
      <label>New type <select id="underwaterKind"><option value="settlement">Settlement</option><option value="marker">Marker</option><option value="route">Route</option><option value="zone">Zone</option><option value="faction">Faction</option></select></label>
      <button id="underwaterAdd" type="button">Add on map</button>
      <label>Object <select id="underwaterObject" style="width:100%"></select></label>
      <label>Name <input id="underwaterName" style="width:100%" /></label>
      <label>Depth <input id="underwaterDepth" type="number" min="0" value="500" step="100" style="width:7em" /> m</label>
      <label>Faction <select id="underwaterFaction"><option value="">None</option></select></label>
      <p><button id="underwaterApply" type="button">Apply changes</button><button id="underwaterMove" type="button">Redraw / move</button><button id="underwaterDelete" type="button">Delete</button></p>
      <p><button id="underwaterFinish" type="button" disabled>Finish area</button><button id="underwaterCancel" type="button" disabled>Cancel placement</button></p>
      <label><input id="underwaterFilter" type="checkbox" class="native" /> Filter depth</label>
      <label class="realm-demo-slider">From <input id="underwaterMin" type="range" min="0" max="10000" step="100" value="0" /><output>0 m</output></label>
      <label class="realm-demo-slider">To <input id="underwaterMax" type="range" min="0" max="10000" step="100" value="10000" /><output>10000 m</output></label>
      <p><button id="underwaterShow" type="button">Show Underwater layer</button><button id="underwaterRefresh" type="button">Refresh</button></p>
    </div><p id="underwaterHint" hidden>Return to Surface to edit Underwater.</p>`;
  document.getElementById("layersContent")?.prepend(panel);
  const actions: Record<string, () => void> = {
    underwaterAdd: () => beginPlacement(false),
    underwaterMove: () => beginPlacement(true),
    underwaterApply: applyChanges,
    underwaterDelete: deleteSelected,
    underwaterFinish: commitDraft,
    underwaterCancel: cancelPlacement,
    underwaterShow: showLayer,
    underwaterRefresh: refreshUnderwaterEditor
  };
  for (const [id, action] of Object.entries(actions)) ensureEl(id).addEventListener("click", () => safely(action));
  ensureEl("underwaterObject").addEventListener("change", () => {
    cancelPlacement();
    selected = Number(ensureEl<HTMLSelectElement>("underwaterObject").value);
    showSelected();
  });
  for (const id of ["underwaterFilter", "underwaterMin", "underwaterMax"])
    ensureEl(id).addEventListener("input", changeFilter);
  // Loading a .map replaces the SVG node. Keep placement attached to the document.
  document.addEventListener("click", onMapClick, true);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && draft) cancelPlacement();
  });
  panel.addEventListener("toggle", () => {
    if (!panel.open) cancelPlacement();
  });
  window.addEventListener("map:generated", () => {
    cancelPlacement();
    selected = undefined;
    refreshUnderwaterEditor();
  });
  window.addEventListener("realm:changed", () => {
    cancelPlacement();
    refreshUnderwaterEditor();
  });
  refreshUnderwaterEditor();
}

function status(text: string): void {
  ensureEl("underwaterStatus").textContent = text;
}
function safely(action: () => void): void {
  try {
    action();
  } catch (error) {
    status(error instanceof Error ? error.message : "Invalid Underwater edit");
  }
}
function showLayer(): void {
  Layers.setGroupVisibility(UNDERWATER_GROUP, true);
  Layers.set([...Layers.state.active, UNDERWATER_LAYER]);
  window.dispatchEvent(new Event("underwater:focus"));
  redraw();
}

function redraw(): void {
  if (Layers.state.active.includes(UNDERWATER_LAYER)) drawUnderwater(underwaterLayer);
}
function requireSurface(): void {
  if (RealmData.active !== "surface" || !grid.cells?.h) throw new Error("Return to Surface first.");
  if (Layers.getGroup(UNDERWATER_GROUP).locked) throw new Error("Unlock the Underwater domain first.");
}

export function refreshUnderwaterEditor(): void {
  if (!document.getElementById("underwaterPanel")) return;
  const surface = RealmData.active === "surface";
  ensureEl("underwaterBody").hidden = !surface;
  ensureEl("underwaterHint").hidden = surface;
  if (!surface) {
    status("");
    return;
  }
  const state = RealmData.underwater.state;
  const objects = ensureEl<HTMLSelectElement>("underwaterObject");
  objects.innerHTML = state.entities
    .map(e => `<option value="${e.i}">${escapeHtml(`${e.kind}: ${e.name}`)}</option>`)
    .join("");
  if (selected !== undefined && state.entities.some(e => e.i === selected)) objects.value = String(selected);
  selected = objects.value === "" ? undefined : Number(objects.value);
  ensureEl<HTMLSelectElement>("underwaterFaction").innerHTML = `<option value="">None</option>${state.entities
    .filter(e => e.kind === "faction")
    .map(e => `<option value="${e.i}">${escapeHtml(e.name)}</option>`)
    .join("")}`;
  showSelected();
  showFilter();
  const issues = grid.cells?.h ? RealmData.underwater.audit(grid) : [];
  status(
    issues.length
      ? `${issues.length} object(s) are now over land or have invalid geometry; preserved but hidden. Redraw / move to repair.`
      : `${state.entities.length} Underwater object(s).`
  );
}

function showSelected(): void {
  const entity = selected === undefined ? undefined : RealmData.underwater.get(selected);
  ensureEl<HTMLInputElement>("underwaterName").value = entity?.name ?? "";
  ensureEl<HTMLInputElement>("underwaterDepth").value = String(entity?.depth ?? 500);
  ensureEl<HTMLSelectElement>("underwaterFaction").value =
    entity?.factionId === undefined ? "" : String(entity.factionId);
  for (const id of ["underwaterMove", "underwaterDelete", "underwaterApply"])
    ensureEl<HTMLButtonElement>(id).disabled = !entity;
}
function editedEntity(entity: UnderwaterEntity): UnderwaterEntity {
  const faction = ensureEl<HTMLSelectElement>("underwaterFaction").value;
  return {
    ...entity,
    name: ensureEl<HTMLInputElement>("underwaterName").value.trim() || entity.name,
    depth: ensureEl<HTMLInputElement>("underwaterDepth").valueAsNumber,
    factionId: faction === "" ? undefined : Number(faction)
  };
}
function applyChanges(): void {
  requireSurface();
  const entity = selected === undefined ? undefined : RealmData.underwater.get(selected);
  if (!entity) return;
  RealmData.underwater.upsert(editedEntity(entity), grid);
  refreshUnderwaterEditor();
  showLayer();
  status("Changes applied.");
}
function deleteSelected(): void {
  requireSurface();
  if (selected === undefined) return;
  RealmData.underwater.remove(selected);
  cancelPlacement();
  selected = undefined;
  refreshUnderwaterEditor();
  redraw();
}
function beginPlacement(move: boolean): void {
  requireSurface();
  const entity = move && selected !== undefined ? RealmData.underwater.get(selected) : undefined;
  const kind = entity?.kind ?? (ensureEl<HTMLSelectElement>("underwaterKind").value as UnderwaterEntityKind);
  const nextId = RealmData.underwater.state.entities.reduce((max, e) => Math.max(max, e.i), -1) + 1;
  draft = editedEntity(entity ?? { i: nextId, kind, name: `Underwater ${kind} ${nextId + 1}`, depth: 500, cells: [] });
  draft.cells = [];
  ensureEl<HTMLInputElement>("underwaterName").value = draft.name;
  ensureEl<HTMLButtonElement>("underwaterCancel").disabled = false;
  ensureEl<HTMLButtonElement>("underwaterFinish").disabled = !(kind === "zone" || kind === "faction");
  ensureEl("viewbox").style.cursor = "crosshair";
  status(
    kind === "route"
      ? "Click two water endpoints; the route will avoid land."
      : kind === "zone" || kind === "faction"
        ? "Click water cells to paint the area, then Finish area."
        : "Click water to place the object."
  );
}
function cancelPlacement(): void {
  draft = undefined;
  ensureEl<HTMLButtonElement>("underwaterCancel").disabled = true;
  ensureEl<HTMLButtonElement>("underwaterFinish").disabled = true;
  ensureEl("viewbox").style.cursor = "default";
  document.getElementById("underwaterDraft")?.remove();
}
function commitDraft(): void {
  requireSurface();
  if (!draft) return;
  RealmData.underwater.upsert(editedEntity(draft), grid);
  selected = draft.i;
  cancelPlacement();
  refreshUnderwaterEditor();
  showLayer();
  status("Object saved. Click it or choose it in the list to edit.");
}
function onMapClick(event: MouseEvent): void {
  if (RealmData.active !== "surface") return;
  const target = event.target as Element;
  if (!target.closest("#map")) return;
  const object = target.closest("[data-underwater-id]");
  if (!draft && !object) return;
  event.stopImmediatePropagation();
  event.preventDefault();
  safely(() => {
    requireSurface();
    if (!draft) {
      selected = Number(object!.getAttribute("data-underwater-id"));
      ensureEl<HTMLDetailsElement>("underwaterPanel").open = true;
      refreshUnderwaterEditor();
      return;
    }
    const [x, y] = pointer(event, ensureEl("viewbox"));
    let cell = -1,
      distance = Infinity;
    grid.points.forEach((point, index) => {
      const d = (point[0] - x) ** 2 + (point[1] - y) ** 2;
      if (d < distance) {
        distance = d;
        cell = index;
      }
    });
    if (!(grid.cells.h[cell] < 20)) throw new Error("Land is not allowed. Choose Surface water.");
    if (draft.kind === "route") {
      if (!draft.cells.length) {
        draft.cells = [cell];
        status("Start chosen. Click the water destination.");
        previewDraft();
        return;
      }
      const path = findPath(
        draft.cells[0],
        id => id === cell,
        (_current, next) => (grid.cells.h[next] < 20 ? 1 : Infinity),
        grid
      );
      if (!path) throw new Error("No water route connects these points. Choose another destination.");
      draft.cells = path;
      commitDraft();
    } else if (draft.kind === "zone" || draft.kind === "faction") {
      if (!draft.cells.includes(cell)) draft.cells.push(cell);
      status(`${draft.cells.length} water cell(s) selected. Finish area to save.`);
      previewDraft();
    } else {
      draft.cells = [cell];
      commitDraft();
    }
  });
}
function previewDraft(): void {
  document.getElementById("underwaterDraft")?.remove();
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.id = "underwaterDraft";
  path.setAttribute(
    "d",
    draft!.cells.map(c => `M${grid.cells.v[c].map(v => grid.vertices.p[v].join(",")).join("L")}Z`).join("")
  );
  path.setAttribute("fill", "#00ecff");
  path.setAttribute("fill-opacity", "0.45");
  path.setAttribute("pointer-events", "none");
  ensureEl("viewbox").append(path);
}
function showFilter(): void {
  const state = RealmData.underwater.state;
  ensureEl<HTMLInputElement>("underwaterFilter").checked = state.filter.enabled;
  const maximum = Math.ceil(Math.max(10000, state.filter.max, ...state.entities.map(e => e.depth)) / 100) * 100;
  for (const [id, value] of [
    ["underwaterMin", state.filter.min],
    ["underwaterMax", state.filter.max]
  ] as const) {
    const input = ensureEl<HTMLInputElement>(id);
    input.max = String(maximum);
    input.value = String(value);
    input.parentElement!.querySelector("output")!.value = `${value} m`;
  }
}
function changeFilter(event: Event): void {
  safely(() => {
    requireSurface();
    let min = Number(ensureEl<HTMLInputElement>("underwaterMin").value),
      max = Number(ensureEl<HTMLInputElement>("underwaterMax").value);
    if (min > max) {
      if ((event.target as Element).id === "underwaterMin") max = min;
      else min = max;
    }
    RealmData.underwater.setFilter({ enabled: ensureEl<HTMLInputElement>("underwaterFilter").checked, min, max });
    showFilter();
    redraw();
  });
}
