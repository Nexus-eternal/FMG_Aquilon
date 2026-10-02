import { Layers } from "@/components/layers";
import { RealmData } from "@/components/realm-data";
import { tip } from "@/components/tooltips";
import { validateWaterRoute } from "@/components/underwater-native";
import { validateVerticalValue } from "@/components/vertical-coordinates";
import type { Route } from "@/generators/routes-generator";
import { Styles } from "@/generators/styles";
import { getRouteEnvironment, ROUTE_ENVIRONMENTS, type RouteEnvironment } from "@/types/route-environment";
import { ensureEl } from "@/utils";

export type EditableRouteEnvironment = Pick<Route, "environment" | "altitude" | "depth" | "endpoints">;

export function appendRouteEnvironmentFields(
  parentId: string,
  object: EditableRouteEnvironment,
  points: () => number[][],
  changed: () => void,
  route?: Route
): void {
  const prefix = `${parentId}Environment`;
  const root = document.createElement("div");
  root.innerHTML = `<div><label class="label" for="${prefix}Type">Environment:</label><select id="${prefix}Type"></select></div>
    <div><label class="label" for="${prefix}Vertical">Height / depth (m):</label><input id="${prefix}Vertical" type="number" min="0" step="100" style="width:9em" /></div>
    <div data-air><label class="label">From city:</label><select id="${prefix}From" style="max-width:22em"></select></div>
    <div data-air><label class="label">To city:</label><select id="${prefix}To" style="max-width:22em"></select></div>`;
  ensureEl(parentId).append(root);
  const type = ensureEl<HTMLSelectElement>(`${prefix}Type`);
  const vertical = ensureEl<HTMLInputElement>(`${prefix}Vertical`);
  for (const [id, name] of Object.entries(ROUTE_ENVIRONMENTS)) type.add(new Option(name, id));
  const selects = [ensureEl<HTMLSelectElement>(`${prefix}From`), ensureEl<HTMLSelectElement>(`${prefix}To`)];
  const choices = RealmData.endpointChoices(pack);
  for (const select of selects) {
    select.add(new Option("Free map point", ""));
    for (const choice of choices) select.add(new Option(choice.name, JSON.stringify(choice.endpoint)));
  }
  object.endpoints?.forEach(endpoint => {
    if (!endpoint || choices.some(choice => JSON.stringify(choice.endpoint) === JSON.stringify(endpoint))) return;
    for (const select of selects)
      select.add(new Option(`Missing city · ${endpoint.realm} #${endpoint.burg}`, JSON.stringify(endpoint)));
  });
  const refresh = () => {
    const environment = getRouteEnvironment(object);
    type.value = environment;
    vertical.disabled = environment === "surface";
    vertical.value = String(environment === "air" ? (object.altitude ?? 1000) : (object.depth ?? 500));
    root.querySelectorAll<HTMLElement>("[data-air]").forEach(el => {
      el.hidden = environment !== "air";
    });
    selects.forEach((select, index) => {
      select.value = object.endpoints?.[index] ? JSON.stringify(object.endpoints[index]) : "";
    });
  };
  const apply = () => {
    const previous = {
      environment: object.environment,
      depth: object.depth,
      altitude: object.altitude,
      endpoints: object.endpoints
    };
    try {
      const environment = type.value as RouteEnvironment;
      const value = vertical.valueAsNumber;
      if (environment !== "surface") validateVerticalValue(value);
      if (environment === "underwater" && points().length) validateWaterRoute(points(), value);
      object.environment = environment;
      if (
        route &&
        environment !== getRouteEnvironment(previous) &&
        ["roads", "trails", "searoutes", "airroutes", "underwaterroutes", "tunnels"].includes(route.group)
      )
        route.group = ensureEnvironmentRouteGroup(environment);
      if (environment === "air") {
        object.altitude = value;
        delete object.depth;
        if (route && getRouteEnvironment(previous) !== "air") route.i = RealmData.nextAirRouteId(pack);
      } else {
        delete object.altitude;
        delete object.endpoints;
        if (environment === "surface") delete object.depth;
        else object.depth = value;
      }
      pack.cells.routes = Routes.buildLinks(pack.routes);
      changed();
    } catch (error) {
      Object.assign(object, previous);
      tip((error as Error).message, false, "error");
    }
    refresh();
  };
  type.addEventListener("change", apply);
  vertical.addEventListener("change", apply);
  vertical.addEventListener("input", () => {
    if (vertical.value !== "" && vertical.validity.valid) apply();
  });
  selects.forEach((select, index) => {
    select.addEventListener("change", () => {
      const selected = choices.find(choice => JSON.stringify(choice.endpoint) === select.value);
      object.endpoints ??= [null, null];
      object.endpoints[index] = select.value ? (selected?.endpoint ?? object.endpoints[index]) : null;
      const burg = selected && RealmData.resolveEndpoint(selected.endpoint, pack);
      const geometry = points();
      if (burg && geometry.length >= 2) {
        const pointIndex = index === 0 ? 0 : geometry.length - 1;
        geometry[pointIndex] = [burg.x, burg.y, Pack.findCell(burg.x, burg.y) ?? 0];
      }
      changed();
    });
  });
  refresh();
}

export function ensureEnvironmentRouteGroup(environment: RouteEnvironment): string {
  const group = { surface: "roads", air: "airroutes", underwater: "underwaterroutes", underground: "tunnels" }[
    environment
  ];
  if (!styles.routes.groups[group]) {
    const attrs = structuredClone(styles.routes.groups.roads.attrs);
    Object.assign(attrs, {
      stroke: environment === "air" ? "#725ba4" : environment === "underwater" ? "#247b8e" : "#78624e",
      "stroke-width": environment === "air" ? 0.7 : 0.8,
      "stroke-dasharray": environment === "air" ? "3 2" : environment === "underground" ? "1 2" : "2 1",
      "stroke-linecap": "round",
      opacity: 0.85
    });
    styles.routes.groups[group] = { attrs };
  }
  Styles.write("routes");
  Layers.draw("routes");
  return group;
}
