import { beforeEach, describe, expect, it } from "vitest";
import type { GridGraph } from "@/types/GridGraph";
import type { PackedGraph } from "@/types/PackedGraph";
import { REALM_DATA_VERSION, RealmDataRegistry } from "./realm-data";

function createGraph(): PackedGraph {
  return {
    cells: {
      burg: Uint16Array.from([0, 1, 0]),
      routes: { 0: { 1: 7 }, 1: { 0: 7 } }
    },
    burgs: [0, { i: 1, name: "Cloudhaven", cell: 1 }],
    markers: [{ i: 3, x: 10, y: 20, type: "cloud", name: "Storm eye" }],
    routes: [
      {
        i: 7,
        group: "roads",
        feature: 1,
        points: [
          [0, 0, 0],
          [1, 1, 1]
        ]
      }
    ],
    zones: [{ i: 2, name: "Calm air", type: "weather", color: "#fff", cells: [1] }],
    addedLabels: [{ i: 4, x: 10, y: 20, label: { text: "Upper Sky", group: "added" } }]
  } as unknown as PackedGraph;
}

function createTerrainGraph(): GridGraph {
  return {
    cells: {
      i: [0, 1, 2],
      h: Uint8Array.from([10, 30, 60]),
      t: Int8Array.from([-1, 1, 2]),
      f: Uint16Array.from([1, 2, 2]),
      temp: Int8Array.from([-4, 0, 8]),
      prec: Uint8Array.from([10, 20, 30])
    },
    features: [0, { i: 1, type: "ocean" }, { i: 2, type: "island" }]
  } as unknown as GridGraph;
}

let registry: RealmDataRegistry;

beforeEach(() => {
  registry = new RealmDataRegistry();
});

describe("RealmDataRegistry", () => {
  it("anchors endpoints by realm plus burg id and follows relocation", () => {
    const graph = createGraph();
    Object.assign(graph.burgs[1], { x: 12, y: 15 });
    registry.save("sky", graph);
    Object.assign(graph.burgs[1], { x: 80, y: 90 });
    const air = {
      ...graph.routes[0],
      environment: "air" as const,
      endpoints: [
        { realm: "surface", burg: 1 },
        { realm: "sky", burg: 1 }
      ] as [{ realm: string; burg: number }, { realm: string; burg: number }]
    };
    expect(registry.routePoints(air, graph).map(p => p.slice(0, 2))).toEqual([
      [80, 90],
      [12, 15]
    ]);
    graph.burgs[1].removed = true;
    expect(registry.routePoints(air, graph)[0]).toEqual(air.points[0]);
  });

  it("stores air routes once and projects live native objects into both realms", () => {
    const surface = createGraph();
    const sky = createGraph();
    const air = {
      ...structuredClone(surface.routes[0]),
      i: 1000000,
      environment: "air" as const,
      endpoints: [
        { realm: "surface", burg: 1 },
        { realm: "sky", burg: 1 }
      ] as [{ realm: string; burg: number }, { realm: string; burg: number }]
    };
    surface.routes.push(air);
    registry.save("surface", surface);
    registry.save("sky", sky);
    expect(registry.get("surface").routes).toHaveLength(1);
    expect(registry.state.airRoutes).toHaveLength(1);
    registry.setActive("sky");
    registry.projectAirRoutes(sky);
    expect(sky.routes.at(-1)).toBe(air);
    sky.routes.at(-1)!.name = "Edited in Sky";
    registry.save("sky", sky);
    registry.setActive("surface");
    registry.projectAirRoutes(surface);
    expect(surface.routes.at(-1)!.name).toBe("Edited in Sky");
    const restored = new RealmDataRegistry();
    restored.restore(JSON.parse(JSON.stringify(registry.state)));
    restored.projectAirRoutes(surface);
    expect(surface.routes.at(-1)!.endpoints).toEqual(air.endpoints);
    surface.routes = surface.routes.filter(route => route.i !== air.i);
    restored.save("surface", surface);
    restored.projectAirRoutes(sky);
    expect(sky.routes.some(route => route.i === air.i)).toBe(false);
  });

  it("serializes Underwater as a domain, without creating another Realm or terrain", () => {
    registry.save("surface", createGraph(), createTerrainGraph());
    registry.underwater.upsert(
      { i: 3, kind: "marker", name: "Deep ruin", depth: 700, cells: [0] },
      createTerrainGraph()
    );
    registry.underwater.setFilter({ enabled: true, min: 300, max: 900 });
    registry.save("sky", createGraph(), createTerrainGraph());
    registry.setActive("sky");
    const restored = new RealmDataRegistry();
    restored.restore(JSON.parse(JSON.stringify(registry.state)));
    expect(restored.underwater.state).toEqual(registry.underwater.state);
    expect(restored.has("underwater")).toBe(false);
    expect(restored.state.domains?.underwater).not.toHaveProperty("terrain");
    expect(restored.active).toBe("sky");
  });

  it("clears domains on reset and loading an old map without domains", () => {
    const entity = { i: 0, kind: "marker" as const, name: "Deep ruin", depth: 0, cells: [0] };
    registry.underwater.upsert(entity, createTerrainGraph());
    registry.reset();
    expect(registry.underwater.state.entities).toEqual([]);
    registry.underwater.upsert(entity, createTerrainGraph());
    registry.restore({ version: 1, activeRealmId: "surface", realms: {} });
    expect(registry.underwater.state.entities).toEqual([]);
  });

  it("captures editable entities without retaining live references", () => {
    const graph = createGraph();
    registry.save("sky", graph);
    graph.markers[0].name = "Changed outside";
    graph.cells.burg[1] = 0;

    const saved = registry.get("sky");
    expect(saved.markers[0].name).toBe("Storm eye");
    expect(saved.cells.burg).toEqual([0, 1, 0]);
  });

  it("activates a realm on the shared graph", () => {
    const graph = createGraph();
    registry.save("sky", graph);

    graph.markers = [];
    graph.routes = [];
    graph.zones = [];
    graph.addedLabels = [];
    graph.burgs = [];
    graph.cells.burg = new Uint16Array(3);
    graph.cells.routes = {};

    registry.activate("sky", graph);

    expect(registry.active).toBe("sky");
    expect(graph.markers[0].name).toBe("Storm eye");
    expect(graph.routes[0].i).toBe(7);
    expect(graph.zones[0].name).toBe("Calm air");
    expect(graph.addedLabels[0].label.text).toBe("Upper Sky");
    expect(Array.from(graph.cells.burg)).toEqual([0, 1, 0]);
    expect(graph.cells.burg).toBeInstanceOf(Uint16Array);
    expect(graph.cells.routes).toEqual({ 0: { 1: 7 }, 1: { 0: 7 } });
  });

  it("round-trips through the serializable versioned state", () => {
    registry.save("sky", createGraph(), createTerrainGraph());
    registry.setActive("sky");

    const serialized = JSON.stringify(registry.state);
    const restored = new RealmDataRegistry();
    restored.restore(JSON.parse(serialized));

    expect(restored.state).toEqual(registry.state);
    expect(restored.state.version).toBe(REALM_DATA_VERSION);
  });

  it("restores Realm terrain onto the same shared grid", () => {
    const terrainGraph = createTerrainGraph();
    registry.save("sky", createGraph(), terrainGraph);
    terrainGraph.cells.h.fill(0);

    registry.applyTerrain("sky", terrainGraph);

    expect(Array.from(terrainGraph.cells.h)).toEqual([10, 30, 60]);
    expect(terrainGraph.features[2].type).toBe("island");
  });

  it("keeps stored terrain when a later entity-only save refreshes the Realm", () => {
    const graph = createGraph();
    const terrainGraph = createTerrainGraph();
    registry.save("sky", graph, terrainGraph);
    graph.markers[0].name = "New marker name";

    registry.save("sky", graph);
    terrainGraph.cells.h.fill(0);
    registry.applyTerrain("sky", terrainGraph);

    expect(registry.get("sky").markers[0].name).toBe("New marker name");
    expect(Array.from(terrainGraph.cells.h)).toEqual([10, 30, 60]);
  });

  it("migrates version 1 entity-only data", () => {
    registry.save("sky", createGraph());
    const legacy = { ...registry.state, version: 1 };
    const restored = new RealmDataRegistry();

    restored.restore(legacy);

    expect(restored.has("sky")).toBe(true);
    expect(restored.hasTerrain("sky")).toBe(false);
    expect(restored.state.version).toBe(REALM_DATA_VERSION);
  });

  it("resets safely when an old map has no realm data", () => {
    registry.save("sky", createGraph());
    registry.restore(undefined);

    expect(registry.active).toBe("surface");
    expect(registry.state.realms).toEqual({});
  });

  it("rejects unknown realms", () => {
    expect(() => registry.get("deep")).toThrow("not registered");
    expect(() => registry.activate("deep", createGraph())).toThrow("not registered");
  });

  it("round-trips island and entity altitude and the filter without affecting Surface", () => {
    const graph = createGraph();
    graph.features = [{ i: 1, land: true, altitude: 3200 }] as PackedGraph["features"];
    graph.markers[0].altitude = 1800;
    registry.save("surface", createGraph());
    registry.save("sky", graph);
    registry.setVerticalFilter("sky", { enabled: true, min: 1000, max: 2000 });
    registry.save("sky", graph);
    const restored = new RealmDataRegistry();
    restored.restore(JSON.parse(JSON.stringify(registry.state)));
    graph.features[0].altitude = 0;
    graph.markers[0].altitude = 0;
    restored.activate("sky", graph);
    expect(graph.features[0].altitude).toBe(3200);
    expect(graph.markers[0].altitude).toBe(1800);
    expect(restored.getVerticalFilter("sky")).toEqual({ enabled: true, min: 1000, max: 2000 });
    expect(restored.getVerticalFilter("surface").enabled).toBe(false);
  });
});
