// Layers tab: a projection of the Layers registry. Renders the layer buttons and wires them up.
import type { LayerId } from "@/components/layers";
import { Layers } from "@/components/layers";
import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";
import { isCtrlClick } from "@/utils";
import { ensureEl, findEl } from "@/utils/nodeUtils";
import { type LayerButton, renderLayerTree } from "./layer-tree";

export type { LayerButton } from "./layer-tree";

interface SortableItem {
  0: HTMLElement;
  data(name: "layer"): string | undefined;
  next(): SortableItem;
}

// only layers listed here get a button, in registry order
export const LAYER_TOGGLES = new Map<LayerId, LayerButton>([
  ["texture", { label: "Te<u>x</u>ture", shortcut: "KeyX" }],
  ["heightmap", { label: "<u>H</u>eightmap", shortcut: "KeyH" }],
  ["lakes", { label: "Lakes", shortcut: "KeyQ" }],
  ["biomes", { label: "<u>B</u>iomes", shortcut: "KeyB" }],
  ["cells", { label: "C<u>e</u>lls", shortcut: "KeyE" }],
  ["grid", { label: "Grid", shortcut: "Semicolon", hint: "; (semicolon)" }],
  ["coordinates", { label: "C<u>o</u>ordinates", shortcut: "KeyO" }],
  ["compass", { label: "<u>W</u>ind Rose", shortcut: "KeyW" }],
  ["rivers", { label: "Ri<u>v</u>ers", shortcut: "KeyV" }],
  ["relief", { label: "Relie<u>f</u>", shortcut: "KeyF" }],
  ["religions", { label: "<u>R</u>eligions", shortcut: "KeyR" }],
  ["cultures", { label: "<u>C</u>ultures", shortcut: "KeyC" }],
  ["states", { label: "<u>S</u>tates", shortcut: "KeyS" }],
  ["provinces", { label: "<u>P</u>rovinces", shortcut: "KeyP" }],
  ["zones", { label: "<u>Z</u>ones", shortcut: "KeyZ" }],
  ["borders", { label: "Bor<u>d</u>ers", shortcut: "KeyD" }],
  ["routes", { label: "Ro<u>u</u>tes", shortcut: "KeyU" }],
  ["temperature", { label: "<u>T</u>emperature", shortcut: "KeyT" }],
  ["ice", { label: "Ice", shortcut: "KeyJ" }],
  ["goods", { label: "<u>G</u>oods", shortcut: "KeyG" }],
  ["markets", { label: "Markets" }],
  ["trade", { label: "Trade", shortcut: "Backquote", hint: "` (backtick)" }],
  ["precipitation", { label: "Precipit<u>a</u>tion", shortcut: "KeyA" }],
  ["population", { label: "Populatio<u>n</u>", shortcut: "KeyN" }],
  ["emblems", { label: "Emblems", shortcut: "KeyY" }],
  ["burgIcons", { label: "<u>I</u>cons", shortcut: "KeyI" }],
  ["labels", { label: "<u>L</u>abels", shortcut: "KeyL" }],
  ["military", { label: "<u>M</u>ilitary", shortcut: "KeyM" }],
  ["markers", { label: "Mar<u>k</u>ers", shortcut: "KeyK" }],
  ["journeys", { label: "Journeys" }],
  ["rulers", { label: "Rulers", shortcut: "Equal", hint: "= (equal sign)" }],
  ["scaleBar", { label: "Scale Bar", shortcut: "Slash", hint: "/ (slash sign)" }],
  ["vignette", { label: "Vignette", shortcut: "BracketLeft", hint: "[ (left square bracket)" }]
]);

// built-in layer presets, in the order the select shows them; the layer sets live in layers-presets
export const LAYER_PRESETS: Record<string, string> = {
  political: "Political map",
  cultural: "Cultural map",
  religions: "Religions map",
  provinces: "Provinces map",
  biomes: "Biomes map",
  heightmap: "Heightmap",
  physical: "Physical map",
  poi: "Places of interest",
  goods: "Goods map",
  trade: "Trade animation",
  military: "Military map",
  emblems: "Emblems",
  landmass: "Pure landmass"
};

export const getLayerByShortcut = (code: string): LayerId | undefined =>
  [...LAYER_TOGGLES].find(([, button]) => button.shortcut === code)?.[0];

const TEMPLATE = /* html */ `
  <p data-tip="Select a map layers preset" style="display: inline-block">Layers preset:</p>
  <select data-tip="Select a map layers preset" id="layersPreset" style="width: 45%">
    ${Object.entries(LAYER_PRESETS)
      .map(([id, label]) => `<option value="${id}">${label}</option>`)
      .join("")}
    <option hidden value="custom">Custom (not saved)</option>
  </select>
  <button
    id="savePresetButton"
    data-tip="Click to save displayed layers as a new preset"
    class="icon-plus sideButton"
    style="display: none"
  ></button>
  <button
    id="removePresetButton"
    data-tip="Click to remove current custom preset"
    class="icon-minus sideButton"
    style="display: none"
  ></button>
  <p>Displayed layers and layer order:</p>
  <section class="layer-tree-root">
    <div class="layer-world-header"><strong>World</strong><span>shared geography</span></div>
    <ul
      data-tip="Click to toggle a layer, drag to raise or lower a layer. Ctrl + click to edit layer style"
      id="mapLayers"
    ></ul>
  </section>
  <div class="tip">Click to toggle, drag to raise or lower the layer</div>
  <div class="tip">Ctrl + click to edit layer style</div>
  <div id="viewMode" data-tip="Set view mode">
    <p>View mode:</p>
    <button data-tip="Standard view mode for editing the map" id="viewStandard" class="pressed">
      Standard
    </button>
    <button
      data-tip="Map presentation in 3D scene. Works best for heightmap. Cannot be used for editing"
      id="viewMesh"
    >
      3D scene
    </button>
    <button data-tip="Project map on globe. Cannot be used for editing" id="viewGlobe">Globe</button>
  </div>
`;

ensureEl("layersContent").innerHTML = TEMPLATE;

function render(): void {
  renderLayerTree(ensureEl("mapLayers"), Layers, LAYER_TOGGLES);
  initializeSortables();
}

ensureEl("mapLayers").addEventListener("click", event => {
  const target = event.target as HTMLElement;
  const groupItem = target.closest<HTMLElement>("li[data-layer-group]");
  const groupId = groupItem?.dataset.layerGroup;
  const action = target.closest<HTMLElement>("[data-group-action]")?.dataset.groupAction;
  if (groupId && action) {
    const group = Layers.getGroup(groupId);
    if (action === "collapse") Layers.setGroupCollapsed(groupId, !group.collapsed);
    else if (action === "visibility") Layers.setGroupVisibility(groupId, !group.visible);
    else if (action === "lock") Layers.setGroupLocked(groupId, !group.locked);
    return;
  }

  const id = target.closest<HTMLElement>("li[data-layer]")?.dataset.layer;
  if (!id || !Layers.has(id)) return;
  if (Layers.getGroupForLayer(id)?.locked) return;

  if (isCtrlClick(event)) return void editStyle(Layers.get(id).elementId);
  Layers.toggle(id);
});

ensureEl("mapLayers").addEventListener("change", event => {
  const input = (event.target as HTMLElement).closest<HTMLInputElement>("input[data-group-opacity]");
  const groupId = input?.closest<HTMLElement>("li[data-layer-group]")?.dataset.layerGroup;
  if (input && groupId) Layers.setGroupOpacity(groupId, Number(input.value));
});

function initializeSortables(): void {
  const root = $("#mapLayers");
  if (!root.hasClass("ui-sortable")) {
    root.sortable({
      items: "> li:not(.solid)",
      containment: "parent",
      cancel: "button, input, .solid, .layer-group-layers",
      update: (_event: Event, ui: { item: SortableItem }) => {
        const id = firstLayerId(ui.item[0]);
        const before = firstLayerId(ui.item.next()[0]);
        if (id && Layers.has(id)) {
          queueMicrotask(() => Layers.move(id, before && Layers.has(before) ? before : undefined));
        }
      }
    });
  }

  $(".layer-group-layers").each((_index: number, element: HTMLElement) => {
    $(element).sortable({
      items: "> li:not(.solid)",
      containment: "parent",
      cancel: ".solid",
      update: (_event: Event, ui: { item: SortableItem }) => {
        const id = ui.item.data("layer");
        const before = ui.item.next().data("layer");
        if (id && Layers.has(id)) {
          queueMicrotask(() => Layers.moveWithinGroup(id, before && Layers.has(before) ? before : undefined));
        }
      }
    });
  });
}

function firstLayerId(element?: HTMLElement): string | undefined {
  if (!element) return;
  if (element.dataset.layer) return element.dataset.layer;
  const groupId = element.dataset.layerGroup;
  return groupId ? Layers.getGroup(groupId).layerIds[0] : undefined;
}

Layers.subscribe(render);
Layers.subscribe(() => ViewportLayers.renderNow());

// the 3d view renders the map as a texture: refresh it on any layer change, once the batch has settled
let view3dRefresh: number | undefined;
Layers.subscribe(() => {
  if (!findEl("canvas3d")) return;
  clearTimeout(view3dRefresh);
  view3dRefresh = window.setTimeout(() => void Controllers.View3d.update(), 400);
});

render();
