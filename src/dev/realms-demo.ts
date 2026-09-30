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
      return (
        id !== SURFACE_BACKDROP_ID &&
        id !== SURFACE_ATMOSPHERE_ID &&
        !(REALM_LAYER_IDS as readonly string[]).includes(id)
      );
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

function drawClouds(layer: Layer): void {
  const editorClouds = layer.id === SKY_EDITOR_CLOUDS_ID;
  if ((editorClouds && activeWorld !== "sky") || (!editorClouds && activeWorld !== "surface")) {
    layer.getEl().replaceChildren();
    return;
  }

  const { width, height } = options.map.graph;
  const seed = cloudSeed(options.map.seed);
  const cloudOffset = -0.78 + cloudDensity * 0.38;
  const cloudOpacity = 0.45 + cloudDensity * 0.5;
  const svg = /* html */ `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
    <defs>
      <filter id="cloud-noise" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="4" seed="${seed}" result="noise" />
        <feColorMatrix in="noise" type="luminanceToAlpha" result="alpha" />
        <feComponentTransfer in="alpha" result="soft-clouds">
          <feFuncA type="gamma" amplitude="1.7" exponent="1.2" offset="${cloudOffset.toFixed(3)}" />
        </feComponentTransfer>
        <feGaussianBlur in="soft-clouds" stdDeviation="6" result="blurred-clouds" />
        <feFlood flood-color="#f7fbff" flood-opacity="${cloudOpacity.toFixed(3)}" result="cloud-colour" />
        <feComposite in="cloud-colour" in2="blurred-clouds" operator="in" />
      </filter>
    </defs>
    ${editorClouds ? `<rect width="${width}" height="${height}" fill="#b9d3eb" fill-opacity="${(1 - groundVisibility).toFixed(3)}" />` : ""}
    <rect width="${width}" height="${height}" fill="transparent" filter="url(#cloud-noise)" />
  </svg>`;
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
    <label class="realm-demo-slider">
      <span>Cloud density</span>
      <input id="realmDemoCloudDensity" type="range" min="0.2" max="1" step="0.05" value="${cloudDensity}" />
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
