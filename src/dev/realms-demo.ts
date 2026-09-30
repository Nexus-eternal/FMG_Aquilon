import { fitMapToScreen } from "@/components/canvas";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { type Layer, Layers, type LayersState } from "@/components/layers";
import { syncOptionInputs } from "@/components/options/tabs/options-tab";
import type { OptionsData } from "@/components/options-schema";
import { Realms } from "@/components/realms";
import { GenerationPipeline } from "@/generators/generation-pipeline";
import { scaleHeightmap } from "@/generators/heightmap-transform";
import { Styles } from "@/generators/styles";
import type { StyleLayerId, Styles as StylesData } from "@/generators/styles-schema";
import type { GridGraph } from "@/types/GridGraph";
import type { PackedGraph } from "@/types/PackedGraph";

const REALM_ID = "sky";
const SURFACE_BACKDROP_ID = "demoSurfaceBackdrop";
const REALM_LAYER_IDS = ["demoSkyTerrain", "demoSkyRoutes", "demoSkyMarkers"] as const;
const SNAPSHOT_PARTS = {
  demoSkyTerrain: ["landmass", "lakes", "coastline"],
  demoSkyRoutes: ["routes"],
  demoSkyMarkers: ["markers"]
} as const;
const SNAPSHOT_STYLE_PROPERTIES = [
  "color",
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "paint-order",
  "filter"
] as const;

interface WorldContext {
  grid: GridGraph;
  pack: PackedGraph;
  options: OptionsData;
  styles: StylesData;
  layers: LayersState;
}

let activeWorld: "surface" | "sky" = "surface";
let surfaceWorld: WorldContext;
let skyWorld: WorldContext;
let generating = false;
const snapshots = new Map<string, string>();

export function installRealmsDemo(): void {
  if (Realms.has(REALM_ID)) return;

  Layers.register(
    {
      id: SURFACE_BACKDROP_ID,
      parent: "viewbox",
      permanent: true,
      keepContent: true,
      draw: drawSnapshot
    },
    { before: "landmass" }
  );
  registerSnapshotLayer("demoSkyTerrain", "Sky Terrain");
  registerSnapshotLayer("demoSkyRoutes", "Sky Routes");
  registerSnapshotLayer("demoSkyMarkers", "Sky Markers");

  Realms.register({
    id: REALM_ID,
    title: "Sky Realm (generated)",
    visible: true,
    opacity: 0.6,
    locked: false,
    layerIds: [...REALM_LAYER_IDS]
  });

  showDemoControls();
  window.addEventListener("map:generated", () => window.setTimeout(() => void onMapGenerated()));
  if (pack.cells?.i?.length) window.setTimeout(() => void onMapGenerated());
}

function registerSnapshotLayer(id: (typeof REALM_LAYER_IDS)[number], title: string): void {
  Layers.register(
    {
      id,
      parent: "viewbox",
      metadata: { title },
      draw: drawSnapshot
    },
    { before: "rulers" }
  );
}

async function onMapGenerated(): Promise<void> {
  if (generating) return;

  if (activeWorld === "sky") {
    skyWorld = captureWorld();
    updateSnapshots();
    return;
  }

  await generateSkyWorld();
}

async function generateSkyWorld(): Promise<void> {
  if (generating) return;
  generating = true;
  setDemoStatus("Generating Sky Realm with Azgaar’s Archipelago preset…");

  try {
    surfaceWorld = captureWorld();
    const realmOptions = structuredClone(surfaceWorld.options);
    realmOptions.map.seed = `${surfaceWorld.options.map.seed}-sky`;
    realmOptions.generation.template = "archipelago";

    globalThis.options = realmOptions;
    globalThis.grid = {} as GridGraph;
    globalThis.pack = {} as PackedGraph;
    Styles.set(structuredClone(surfaceWorld.styles));

    await GenerationPipeline.run({
      transformHeightmap: graph => scaleHeightmap(graph, { scale: 0.32, borderRatio: 0.08 })
    });

    const realmLayers = structuredClone(surfaceWorld.layers);
    realmLayers.active = [...new Set([...realmLayers.active, "routes", "markers", "lakes"])];
    setRealmVisibility(realmLayers, false);
    Layers.restore(realmLayers);
    writeStyles();
    Layers.drawAll();

    skyWorld = captureWorld();
    updateSnapshots();

    applyWorld(surfaceWorld);
    Layers.set([...Layers.state.active, ...REALM_LAYER_IDS]);
    Realms.setVisibility(REALM_ID, true);
    surfaceWorld = captureWorld();
    setDemoStatus("Sky Realm uses a real generated world. Enter it to edit with the standard Tools menu.");
  } catch (error) {
    console.error("Could not generate Sky Realm", error);
    setDemoStatus("Sky Realm generation failed. Check the browser console.");
    if (surfaceWorld) applyWorld(surfaceWorld);
  } finally {
    generating = false;
  }
}

function captureWorld(): WorldContext {
  return {
    grid,
    pack,
    options,
    styles,
    layers: structuredClone(Layers.state)
  };
}

function applyWorld(world: WorldContext): void {
  globalThis.grid = world.grid;
  globalThis.pack = world.pack;
  globalThis.options = world.options;
  Styles.set(world.styles);
  Layers.restore(world.layers);
  writeStyles();
  Layers.drawAll();
  syncOptionInputs();
  fitMapToScreen();
}

function writeStyles(): void {
  Styles.write(...(Object.keys(styles) as StyleLayerId[]));
}

function setRealmVisibility(state: LayersState, visible: boolean): void {
  const group = state.groups?.find(group => group.id === `realm-${REALM_ID}`);
  if (group) group.visible = visible;
}

function updateSnapshots(): void {
  for (const [layerId, sourceIds] of Object.entries(SNAPSHOT_PARTS)) {
    snapshots.set(layerId, createSnapshot(sourceIds));
  }
}

function updateSurfaceBackdrop(): void {
  const sourceIds = Layers.all
    .filter(layer => layer.parent === "viewbox")
    .filter(layer => Layers.isOn(layer.id))
    .filter(layer => {
      const id = String(layer.id);
      return id !== SURFACE_BACKDROP_ID && !(REALM_LAYER_IDS as readonly string[]).includes(id);
    })
    .map(layer => layer.elementId);
  snapshots.set(SURFACE_BACKDROP_ID, createSnapshot(sourceIds));
}

function createSnapshot(sourceIds: readonly string[]): string {
  const source = document.querySelector<SVGSVGElement>("#map");
  if (!source) throw new Error("Map SVG is missing");
  const clone = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("viewBox", `0 0 ${options.map.graph.width} ${options.map.graph.height}`);
  clone.setAttribute("width", String(options.map.graph.width));
  clone.setAttribute("height", String(options.map.graph.height));
  clone.style.background = "transparent";

  const definitions = source.querySelector("defs")?.cloneNode(true);
  if (definitions) clone.append(definitions);

  const viewbox = document.createElementNS("http://www.w3.org/2000/svg", "g");
  for (const sourceId of sourceIds) {
    const sourceLayer = source.querySelector<SVGElement>(`#${CSS.escape(sourceId)}`);
    if (!sourceLayer) continue;
    const layer = sourceLayer.cloneNode(true) as SVGElement;
    layer.removeAttribute("style");
    if (sourceId === "landmass") layer.setAttribute("mask", "url(#land)");
    inlineStyles(sourceLayer, layer);
    viewbox.append(layer);
  }
  clone.append(viewbox);

  const xml = new XMLSerializer().serializeToString(clone);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
}

function inlineStyles(source: Element, target: Element): void {
  const computed = getComputedStyle(source);
  for (const property of SNAPSHOT_STYLE_PROPERTIES) {
    const value = computed.getPropertyValue(property);
    if (value) (target as SVGElement).style.setProperty(property, value);
  }

  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);
  for (let index = 0; index < Math.min(sourceChildren.length, targetChildren.length); index++) {
    inlineStyles(sourceChildren[index], targetChildren[index]);
  }
}

function drawSnapshot(layer: Layer): void {
  if (layer.id === SURFACE_BACKDROP_ID && activeWorld !== "sky") {
    layer.getEl().replaceChildren();
    return;
  }

  const href = snapshots.get(layer.id);
  if (!href) return void layer.getEl().replaceChildren();

  const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
  image.setAttribute("href", href);
  image.setAttribute("width", String(options.map.graph.width));
  image.setAttribute("height", String(options.map.graph.height));
  image.setAttribute("pointer-events", "none");
  layer.getEl().replaceChildren(image);
}

async function toggleWorld(): Promise<void> {
  if (generating || !skyWorld) return;
  closeDialogs();

  if (activeWorld === "surface") {
    surfaceWorld = captureWorld();
    updateSurfaceBackdrop();
    activeWorld = "sky";
    applyWorld(skyWorld);
    setDemoStatus("Editing Sky Realm over the live Surface backdrop. Sky oceans are transparent.");
  } else {
    Layers.drawAll();
    skyWorld = captureWorld();
    updateSnapshots();
    activeWorld = "surface";
    applyWorld(surfaceWorld);
    setDemoStatus("Sky Realm overlay refreshed from the edited world.");
  }

  updateSwitchButton();
}

function showDemoControls(): void {
  if (document.getElementById("realmDemoControls")) return;
  const controls = document.createElement("div");
  controls.id = "realmDemoControls";
  controls.innerHTML = /* html */ `
    <strong>Generated Realm demo</strong>
    <span id="realmDemoStatus">Waiting for the Surface map…</span>
    <button id="realmDemoSwitch" type="button">Enter Sky Realm editor</button>
  `;
  controls.querySelector("button")?.addEventListener("click", () => void toggleWorld());
  document.getElementById("layersContent")?.prepend(controls);
}

function setDemoStatus(message: string): void {
  const status = document.getElementById("realmDemoStatus");
  if (status) status.textContent = message;
}

function updateSwitchButton(): void {
  const button = document.getElementById("realmDemoSwitch");
  if (button) button.textContent = activeWorld === "surface" ? "Enter Sky Realm editor" : "Return to Surface";
}
