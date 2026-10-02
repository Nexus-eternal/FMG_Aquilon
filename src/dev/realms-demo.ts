import { fitMapToScreen } from "@/components/canvas";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { type Layer, Layers, type LayersState } from "@/components/layers";
import { MapSaveContext } from "@/components/map-save-context";
import { syncOptionInputs } from "@/components/options/tabs/options-tab";
import type { OptionsData } from "@/components/options-schema";
import { RealmData } from "@/components/realm-data";
import { applyRealmTerrain, captureRealmTerrain, type RealmTerrainData } from "@/components/realm-terrain";
import { Realms } from "@/components/realms";
import {
  installVerticalCoordinatesEditor,
  refreshVerticalCoordinatesEditor
} from "@/controllers/vertical-coordinates-editor";
import { GenerationPipeline, PackGenerationPipeline } from "@/generators/generation-pipeline";
import { scaleHeightmap } from "@/generators/heightmap-transform";
import { Styles } from "@/generators/styles";
import type { StyleLayerId, Styles as StylesData } from "@/generators/styles-schema";
import { drawVerticalFilter } from "@/renderers/draw-vertical-filter";
import type { PackedGraph } from "@/types/PackedGraph";
import { createRealmCloudSvg } from "./realm-clouds";

const REALM_ID = "sky";
const SURFACE_BACKDROP_ID = "demoSurfaceBackdrop";
const SURFACE_ATMOSPHERE_ID = "demoSurfaceAtmosphere";
const SKY_EDITOR_CLOUDS_ID = "demoSkyEditorClouds";
const REALM_LAYER_IDS = ["demoSkyClouds", "demoSkyTerrain", "demoSkyRoutes", "demoSkyMarkers"] as const;
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
  terrain: RealmTerrainData;
  pack: PackedGraph;
  options: OptionsData;
  styles: StylesData;
  layers: LayersState;
}

let activeWorld: "surface" | "sky" = "surface";
let surfaceWorld: WorldContext;
let skyWorld: WorldContext;
let generating = false;
let cloudDensity = 0.85;
let groundVisibility = 0.65;
let realmCloudLayer: Layer;
let editorCloudLayer: Layer;
let surfaceAtmosphereLayer: Layer;
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
  editorCloudLayer = Layers.register(
    {
      id: SKY_EDITOR_CLOUDS_ID,
      parent: "viewbox",
      permanent: true,
      keepContent: true,
      draw: drawClouds
    },
    { before: "landmass" }
  );
  surfaceAtmosphereLayer = Layers.register(
    {
      id: SURFACE_ATMOSPHERE_ID,
      parent: "viewbox",
      permanent: true,
      keepContent: true,
      draw: drawSurfaceAtmosphere
    },
    { before: "rulers" }
  );
  realmCloudLayer = Layers.register(
    {
      id: "demoSkyClouds",
      parent: "viewbox",
      metadata: { title: "Sky Clouds" },
      draw: drawClouds
    },
    { before: "rulers" }
  );
  registerSnapshotLayer("demoSkyTerrain", "Sky Terrain");
  registerSnapshotLayer("demoSkyRoutes", "Sky Routes");
  registerSnapshotLayer("demoSkyMarkers", "Sky Markers");

  Realms.register({
    id: REALM_ID,
    title: "Sky Realm (generated)",
    visible: true,
    opacity: 1,
    locked: false,
    layerIds: [...REALM_LAYER_IDS]
  });
  MapSaveContext.register(prepareSurfaceForSave);
  Layers.register(
    { id: "realmVerticalFilter", parent: "viewbox", permanent: true, draw: drawVerticalFilter },
    { before: "rulers" }
  );

  showDemoControls();
  window.addEventListener("underwater:focus", () => {
    if (activeWorld !== "surface") return;
    cloudDensity = 0;
    groundVisibility = 1;
    for (const [id, value] of [
      ["realmDemoCloudDensity", 0],
      ["realmDemoGroundVisibility", 1]
    ] as const) {
      const input = document.getElementById(id) as HTMLInputElement;
      input.value = String(value);
      input.parentElement!.querySelector("output")!.value = `${value * 100}%`;
    }
    redrawClouds();
  });
  const viewbox = document.getElementById("viewbox");
  if (viewbox) new MutationObserver(drawVerticalFilter).observe(viewbox, { childList: true, subtree: true });
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

  // Saved multi-Realm maps always load their canonical Surface as the main .map body.
  if (RealmData.active === "surface") activeWorld = "surface";

  if (activeWorld === "sky") {
    skyWorld = captureWorld();
    RealmData.save(REALM_ID, skyWorld.pack, grid);
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
    RealmData.save("surface", surfaceWorld.pack, grid);
    const realmOptions = structuredClone(surfaceWorld.options);
    realmOptions.map.seed = `${surfaceWorld.options.map.seed}-sky`;
    realmOptions.generation.template = "archipelago";

    globalThis.options = realmOptions;
    globalThis.pack = {} as PackedGraph;
    Styles.set(structuredClone(surfaceWorld.styles));

    if (RealmData.hasTerrain(REALM_ID)) {
      RealmData.applyTerrain(REALM_ID, grid);
      await PackGenerationPipeline.run({});
    } else {
      await GenerationPipeline.run({
        graph: grid,
        transformHeightmap: graph => scaleHeightmap(graph, { scale: 0.32, borderRatio: 0.08 })
      });
    }

    // A loaded .map can carry edits made with the standard editors in this Realm.
    // The restored or newly generated terrain above rebuilds the derived pack, then
    // scoped data replaces only the Realm-owned entities on the shared cell indices.
    if (RealmData.has(REALM_ID)) RealmData.activate(REALM_ID, pack);
    RealmData.setActive(REALM_ID);

    const realmLayers = structuredClone(surfaceWorld.layers);
    realmLayers.active = [...new Set([...realmLayers.active, "routes", "markers", "lakes"])];
    setRealmVisibility(realmLayers, false);
    Layers.restore(realmLayers);
    writeStyles();
    Layers.drawAll();

    skyWorld = captureWorld();
    RealmData.save(REALM_ID, skyWorld.pack, grid);
    updateSnapshots();

    applyWorld(surfaceWorld, "surface");
    RealmData.setActive("surface");
    Layers.set([...Layers.state.active, ...REALM_LAYER_IDS]);
    Realms.setVisibility(REALM_ID, true);
    surfaceWorld = captureWorld();
    setDemoStatus("Sky Realm uses a real generated world. Enter it to edit with the standard Tools menu.");
    refreshVerticalCoordinatesEditor();
  } catch (error) {
    console.error("Could not generate Sky Realm", error);
    setDemoStatus("Sky Realm generation failed. Check the browser console.");
    if (surfaceWorld) applyWorld(surfaceWorld, "surface");
  } finally {
    generating = false;
  }
}

function captureWorld(): WorldContext {
  return {
    terrain: captureRealmTerrain(grid),
    pack,
    options,
    styles,
    layers: structuredClone(Layers.state)
  };
}

function applyWorld(world: WorldContext, realmId: "surface" | "sky"): void {
  RealmData.setActive(realmId);
  applyRealmTerrain(grid, world.terrain);
  globalThis.pack = world.pack;
  RealmData.projectAirRoutes(pack);
  globalThis.options = world.options;
  Styles.set(world.styles);
  for (const route of pack.routes) {
    if (route.environment !== "air" || styles.routes.groups[route.group]) continue;
    const attrs = structuredClone(styles.routes.groups.roads.attrs);
    Object.assign(attrs, {
      stroke: "#725ba4",
      "stroke-width": 0.7,
      "stroke-dasharray": "3 2",
      "stroke-linecap": "round",
      opacity: 0.85
    });
    styles.routes.groups[route.group] = { attrs };
  }
  Layers.restore(world.layers);
  writeStyles();
  Layers.drawAll();
  window.dispatchEvent(new Event("realm:changed"));
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
      return (
        id !== SURFACE_BACKDROP_ID &&
        id !== SURFACE_ATMOSPHERE_ID &&
        id !== "underwaterObjects" &&
        !(REALM_LAYER_IDS as readonly string[]).includes(id)
      );
    })
    .map(layer => layer.elementId);
  snapshots.set(SURFACE_BACKDROP_ID, createSnapshot(sourceIds, true));
}

function createSnapshot(sourceIds: readonly string[], excludeUnderwater = false): string {
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
  for (const route of pack.routes) {
    if (route.environment !== "air") continue;
    for (const prefix of ["route", "routeHalo", "routePorts", "routeLabel"])
      clone.querySelector(`#${prefix}${route.i}`)?.remove();
  }

  // The Surface backdrop is a view from above, not a second rendering of deep-sea objects.
  if (excludeUnderwater) {
    const remove = (id: string) => clone.querySelector(`#${CSS.escape(id)}`)?.remove();
    for (const burg of pack.burgs) {
      if (burg.depth === undefined) continue;
      for (const prefix of ["burg", "anchor", "burgLabel"]) remove(`${prefix}${burg.i}`);
      clone.querySelector(`#burgEmblems use[data-i="${burg.i}"]`)?.remove();
    }
    for (const route of pack.routes) {
      if (route.depth === undefined || route.environment === "underground") continue;
      remove(`route${route.i}`);
      remove(`routeLabel${route.i}`);
    }
    for (const marker of pack.markers) if (marker.depth !== undefined) remove(`marker${marker.i}`);
    for (const zone of pack.zones) if (zone.depth !== undefined) remove(`zone${zone.i}`);
  }

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

function drawClouds(layer: Layer): void {
  const editorClouds = layer.id === SKY_EDITOR_CLOUDS_ID;
  if ((editorClouds && activeWorld !== "sky") || (!editorClouds && activeWorld !== "surface")) {
    layer.getEl().replaceChildren();
    return;
  }

  const { width, height } = options.map.graph;
  const seed = cloudSeed(options.map.seed);
  const svg = createRealmCloudSvg({ width, height, seed, density: cloudDensity, groundVisibility, editorClouds });
  const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
  image.setAttribute("href", `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  image.setAttribute("width", String(width));
  image.setAttribute("height", String(height));
  image.setAttribute("pointer-events", "none");
  layer.getEl().replaceChildren(image);
}

function drawSurfaceAtmosphere(layer: Layer): void {
  if (activeWorld !== "surface") return void layer.getEl().replaceChildren();

  const veil = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  veil.setAttribute("width", String(options.map.graph.width));
  veil.setAttribute("height", String(options.map.graph.height));
  veil.setAttribute("fill", "#b9d3eb");
  veil.setAttribute("fill-opacity", String(1 - groundVisibility));
  veil.setAttribute("pointer-events", "none");
  layer.getEl().replaceChildren(veil);
}

function cloudSeed(value: string): number {
  let seed = 0;
  for (const character of value) seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  return seed % 1000;
}

async function toggleWorld(): Promise<void> {
  if (generating || !skyWorld) return;
  closeDialogs();

  if (activeWorld === "surface") {
    surfaceWorld = captureWorld();
    RealmData.save("surface", surfaceWorld.pack, grid);
    updateSurfaceBackdrop();
    activeWorld = "sky";
    applyWorld(skyWorld, "sky");
    RealmData.setActive(REALM_ID);
    setDemoStatus("Editing Sky Realm over the live Surface backdrop. Sky oceans are transparent.");
  } else {
    Layers.drawAll();
    skyWorld = captureWorld();
    RealmData.save(REALM_ID, skyWorld.pack, grid);
    updateSnapshots();
    activeWorld = "surface";
    applyWorld(surfaceWorld, "surface");
    RealmData.setActive("surface");
    setDemoStatus("Sky Realm overlay refreshed from the edited world.");
  }

  updateSwitchButton();
  refreshVerticalCoordinatesEditor();
}

async function prepareSurfaceForSave(): Promise<() => void> {
  if (activeWorld === "surface") {
    surfaceWorld = captureWorld();
    RealmData.save("surface", surfaceWorld.pack, grid);
    return () => undefined;
  }

  skyWorld = captureWorld();
  RealmData.save(REALM_ID, skyWorld.pack, grid);
  activeWorld = "surface";
  applyWorld(surfaceWorld, "surface");
  RealmData.setActive("surface");
  updateSwitchButton();

  return () => {
    surfaceWorld = captureWorld();
    RealmData.save("surface", surfaceWorld.pack, grid);
    activeWorld = "sky";
    applyWorld(skyWorld, "sky");
    RealmData.setActive(REALM_ID);
    updateSwitchButton();
  };
}

function showDemoControls(): void {
  if (document.getElementById("realmDemoControls")) return;
  const controls = document.createElement("div");
  controls.id = "realmDemoControls";
  controls.innerHTML = /* html */ `
    <strong>Generated Realm demo</strong>
    <span id="realmDemoStatus">Waiting for the Surface map…</span>
    <label class="realm-demo-slider">
      <span>Cloud density</span>
      <input id="realmDemoCloudDensity" type="range" min="0" max="1" step="0.05" value="${cloudDensity}" />
      <output>${Math.round(cloudDensity * 100)}%</output>
    </label>
    <label class="realm-demo-slider">
      <span>Ground visibility</span>
      <input id="realmDemoGroundVisibility" type="range" min="0" max="1" step="0.05" value="${groundVisibility}" />
      <output>${Math.round(groundVisibility * 100)}%</output>
    </label>
    <button id="realmDemoSwitch" type="button">Enter Sky Realm editor</button>
  `;
  document.getElementById("layersContent")?.prepend(controls);
  installVerticalCoordinatesEditor(controls, () => {
    RealmData.save(REALM_ID, pack, grid);
  });
  controls.querySelector("button")?.addEventListener("click", () => void toggleWorld());
  bindAtmosphereSlider("realmDemoCloudDensity", value => (cloudDensity = value));
  bindAtmosphereSlider("realmDemoGroundVisibility", value => (groundVisibility = value));
}

function bindAtmosphereSlider(id: string, update: (value: number) => void): void {
  const input = document.getElementById(id) as HTMLInputElement | null;
  if (!input) return;

  input.addEventListener("input", () => {
    const value = Number(input.value);
    update(value);
    const output = input.parentElement?.querySelector("output");
    if (output) output.value = `${Math.round(value * 100)}%`;
    redrawClouds();
  });
}

function redrawClouds(): void {
  if (realmCloudLayer) drawClouds(realmCloudLayer);
  if (editorCloudLayer) drawClouds(editorCloudLayer);
  if (surfaceAtmosphereLayer) drawSurfaceAtmosphere(surfaceAtmosphereLayer);
}

function setDemoStatus(message: string): void {
  const status = document.getElementById("realmDemoStatus");
  if (status) status.textContent = message;
}

function updateSwitchButton(): void {
  const button = document.getElementById("realmDemoSwitch");
  if (button) button.textContent = activeWorld === "surface" ? "Enter Sky Realm editor" : "Return to Surface";
}
