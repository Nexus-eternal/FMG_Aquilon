import { beforeEach, describe, expect, it } from "vitest";
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

let registry: RealmDataRegistry;

beforeEach(() => {
  registry = new RealmDataRegistry();
});

describe("RealmDataRegistry", () => {
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
    registry.save("sky", createGraph());
    registry.setActive("sky");

    const serialized = JSON.stringify(registry.state);
    const restored = new RealmDataRegistry();
    restored.restore(JSON.parse(serialized));

    expect(restored.state).toEqual(registry.state);
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
});
