import { type Layer, Layers } from "@/components/layers";
import { Realms } from "@/components/realms";

const DEMO_LAYER_IDS = ["demoSkyIslands", "demoSkyRoutes", "demoSkyMarkers"] as const;

export function installRealmsDemo(): void {
  if (Realms.has("sky")) return;

  Layers.register(
    {
      id: "demoSkyIslands",
      parent: "viewbox",
      metadata: { title: "Sky Islands" },
      draw: drawSkyIslands
    },
    { before: "rulers" }
  );
  Layers.register(
    {
      id: "demoSkyRoutes",
      parent: "viewbox",
      metadata: { title: "Air Routes" },
      draw: drawSkyRoutes
    },
    { before: "rulers" }
  );
  Layers.register(
    {
      id: "demoSkyMarkers",
      parent: "viewbox",
      metadata: { title: "Sky Markers" },
      draw: drawSkyMarkers
    },
    { before: "rulers" }
  );

  Realms.register({
    id: "sky",
    title: "Sky Realm (demo)",
    visible: true,
    opacity: 0.85,
    locked: false,
    layerIds: [...DEMO_LAYER_IDS]
  });
  Layers.set([...Layers.state.active, ...DEMO_LAYER_IDS]);
  showDemoNotice();
}

function drawSkyIslands(layer: Layer): void {
  const group = layer.getEl();
  const { width, height } = getMapSize(group);
  group.replaceChildren(
    createSvg("ellipse", {
      cx: String(width * 0.24),
      cy: String(height * 0.26),
      rx: String(width * 0.07),
      ry: String(height * 0.03),
      fill: "#f5dc88",
      stroke: "#704f91"
    }),
    createSvg("ellipse", {
      cx: String(width * 0.52),
      cy: String(height * 0.18),
      rx: String(width * 0.09),
      ry: String(height * 0.04),
      fill: "#d7f0a2",
      stroke: "#704f91"
    }),
    createSvg("ellipse", {
      cx: String(width * 0.76),
      cy: String(height * 0.34),
      rx: String(width * 0.06),
      ry: String(height * 0.028),
      fill: "#f4b8cf",
      stroke: "#704f91"
    })
  );
  group.setAttribute("stroke-width", "2");
  group.setAttribute("pointer-events", "none");
}

function drawSkyRoutes(layer: Layer): void {
  const group = layer.getEl();
  const { width, height } = getMapSize(group);
  group.replaceChildren(
    createSvg("path", {
      d: `M ${width * 0.24} ${height * 0.26} Q ${width * 0.38} ${height * 0.05} ${width * 0.52} ${height * 0.18} T ${width * 0.76} ${height * 0.34}`,
      fill: "none",
      stroke: "#6b3f8f",
      "stroke-width": "2",
      "stroke-dasharray": "7 5"
    })
  );
  group.setAttribute("pointer-events", "none");
}

function drawSkyMarkers(layer: Layer): void {
  const group = layer.getEl();
  const { width, height } = getMapSize(group);
  group.replaceChildren(
    createMarker(width * 0.24, height * 0.26, "Aerie"),
    createMarker(width * 0.52, height * 0.18, "Cloudhaven"),
    createMarker(width * 0.76, height * 0.34, "Zephyr Gate")
  );
  group.setAttribute("pointer-events", "none");
}

function createMarker(x: number, y: number, label: string): SVGGElement {
  const marker = createSvg<SVGGElement>("g", { transform: `translate(${x} ${y})` });
  marker.append(
    createSvg("circle", { r: "5", fill: "#6b3f8f", stroke: "white", "stroke-width": "1.5" }),
    createSvg("text", { x: "8", y: "3", fill: "#2e193d", "font-size": "11", "font-weight": "bold" }, label)
  );
  return marker;
}

function getMapSize(group: SVGGElement): { width: number; height: number } {
  const map = group.ownerSVGElement;
  const width = map?.viewBox.baseVal.width || Number(map?.getAttribute("width")) || 1000;
  const height = map?.viewBox.baseVal.height || Number(map?.getAttribute("height")) || 1000;
  return { width, height };
}

function createSvg<Element extends SVGElement = SVGElement>(
  tag: string,
  attributes: Record<string, string>,
  text?: string
): Element {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag) as Element;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (text) element.textContent = text;
  return element;
}

function showDemoNotice(): void {
  if (document.getElementById("realmDemoNotice")) return;
  const notice = document.createElement("p");
  notice.id = "realmDemoNotice";
  notice.textContent = "Realm demo mode — local testing only";
  document.getElementById("layersContent")?.prepend(notice);
}
