import type { Layer } from "@/components/layers";
import { RealmData } from "@/components/realm-data";
import type { UnderwaterEntity } from "@/components/underwater-domain";
import type { GridGraph } from "@/types/GridGraph";
import type { Point } from "@/types/global";

export const UNDERWATER_LAYER = "underwaterObjects";
export const UNDERWATER_GROUP = "domain-underwater";

export function underwaterRoutePoints(cells: number[], graph: GridGraph): Point[] {
  const points: Point[] = [];
  for (let index = 0; index < cells.length; index++) {
    const cell = cells[index];
    if (index) {
      const shared = graph.cells.v[cell].filter(vertex => graph.cells.v[cells[index - 1]].includes(vertex));
      if (shared.length !== 2) throw new Error("Route corridor has no shared Voronoi edge.");
      const [a, b] = shared.map(vertex => graph.vertices.p[vertex]);
      points.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
    }
    points.push(graph.points[cell]);
  }
  return points;
}

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string>
): SVGElementTagNameMap[K] {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function entityElement(entity: UnderwaterEntity, graph: GridGraph): SVGGElement {
  const group = svg("g", { "data-underwater-id": String(entity.i), id: `underwater-${entity.i}`, cursor: "pointer" });
  const title = svg("title", {});
  title.textContent = `${entity.name} — ${entity.depth} m below sea level`;
  group.append(title);
  const color = entity.kind === "faction" ? "#7c5bb2" : "#006c82";
  if (entity.kind === "zone" || entity.kind === "faction") {
    const d = entity.cells
      .map(cell => `M${graph.cells.v[cell].map(v => graph.vertices.p[v].join(",")).join("L")}Z`)
      .join("");
    group.append(svg("path", { d, fill: color, "fill-opacity": "0.28", stroke: color, "stroke-width": "0.4" }));
  } else if (entity.kind === "route") {
    const d = `M${underwaterRoutePoints(entity.cells, graph)
      .map(point => point.join(","))
      .join("L")}`;
    group.append(svg("path", { d, fill: "none", stroke: color, "stroke-width": "2", "stroke-dasharray": "5 2" }));
    group.append(svg("path", { d, fill: "none", stroke: "transparent", "stroke-width": "10" }));
  } else {
    const [x, y] = graph.points[entity.cells[0]];
    group.append(
      svg(
        entity.kind === "settlement" ? "rect" : "circle",
        entity.kind === "settlement"
          ? {
              x: String(x - 4),
              y: String(y - 4),
              width: "8",
              height: "8",
              fill: "#bff7ff",
              stroke: color,
              "stroke-width": "1.5"
            }
          : { cx: String(x), cy: String(y), r: "4", fill: "#bff7ff", stroke: color, "stroke-width": "1.5" }
      )
    );
  }
  const [x, y] = graph.points[entity.cells[Math.floor(entity.cells.length / 2)]];
  const label = svg("text", {
    x: String(x + 7),
    y: String(y - 7),
    fill: color,
    "font-size": "11",
    "font-family": "Arial",
    stroke: "#eefaff",
    "stroke-width": "2",
    "paint-order": "stroke",
    "pointer-events": "none"
  });
  label.textContent = `${entity.name} (${entity.depth} m)`;
  group.append(label);
  return group;
}

export function drawUnderwater(layer: Layer): void {
  const element = layer.getEl();
  element.replaceChildren();
  if (RealmData.active !== "surface" || !grid.cells?.h) return;
  const entities = RealmData.underwater.getVisible(grid);
  const order = { faction: 0, zone: 1, route: 2, settlement: 3, marker: 4 };
  for (const entity of entities.sort((a, b) => order[a.kind] - order[b.kind]))
    element.append(entityElement(entity, grid));
}
