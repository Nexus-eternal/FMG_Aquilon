import { describe, expect, it } from "vitest";
import type { GridGraph } from "@/types/GridGraph";
import { UnderwaterDomainRegistry, type UnderwaterEntity } from "./underwater-domain";

function surface(): GridGraph {
  return {
    cells: {
      h: Uint8Array.from([5, 19, 20, 0]),
      c: [[1], [0, 2], [1, 3], [2]]
    }
  } as unknown as GridGraph;
}

function marker(overrides: Partial<UnderwaterEntity> = {}): UnderwaterEntity {
  return { i: 0, kind: "marker", name: "Deep spring", depth: 500, cells: [0], ...overrides };
}

describe("UnderwaterDomainRegistry", () => {
  it("owns domain entities without mutating or copying Surface geography", () => {
    const domain = new UnderwaterDomainRegistry();
    const graph = surface();
    const original = structuredClone(graph);
    const entity = marker();
    domain.upsert(entity, graph);
    entity.cells[0] = 2;
    entity.depth = 3000;
    const read = domain.get(0)!;
    read.name = "Edited outside";
    expect(domain.get(0)).toEqual(marker());
    expect(graph).toEqual(original);
    expect(domain.state).not.toHaveProperty("terrain");
    expect(domain.state).not.toHaveProperty("grid");
  });

  it.each(["settlement", "marker", "zone", "faction"] as const)("rejects %s on land atomically", kind => {
    const domain = new UnderwaterDomainRegistry();
    domain.upsert(marker(), surface());
    expect(() => domain.upsert(marker({ kind, cells: [2] }), surface())).toThrow(/water cells/);
    expect(domain.get(0)).toEqual(marker());
  });

  it.each([-1, NaN, Infinity])("rejects invalid depth %s without losing the previous object", depth => {
    const domain = new UnderwaterDomainRegistry();
    domain.upsert(marker(), surface());
    expect(() => domain.upsert(marker({ depth }), surface())).toThrow(/depth/);
    expect(domain.get(0)?.depth).toBe(500);
  });

  it.each([[-1], [4], [0.5], [], [0, 1]].map(cells => ({ cells })))(
    "rejects invalid point footprint $cells",
    ({ cells }) => {
      expect(() => new UnderwaterDomainRegistry().upsert(marker({ cells }), surface())).toThrow();
    }
  );

  it("checks the entire route corridor, not only water endpoints", () => {
    const domain = new UnderwaterDomainRegistry();
    domain.upsert(marker({ kind: "route", cells: [0, 1], depth: 0 }), surface());
    expect(() => domain.upsert(marker({ kind: "route", cells: [0, 1, 2, 3] }), surface())).toThrow(/water cells/);
    expect(() => domain.upsert(marker({ kind: "route", cells: [0, 3] }), surface())).toThrow(/adjacent/);
    expect(domain.get(0)?.cells).toEqual([0, 1]);
  });

  it("filters inclusively, including zero, without deleting hidden entities", () => {
    const domain = new UnderwaterDomainRegistry();
    domain.upsert(marker({ depth: 0 }), surface());
    domain.upsert(marker({ i: 1, depth: 500 }), surface());
    domain.upsert(marker({ i: 2, depth: 1500 }), surface());
    domain.setFilter({ enabled: true, min: 0, max: 500 });
    expect(domain.getVisible(surface()).map(entity => entity.i)).toEqual([0, 1]);
    expect(domain.state.entities).toHaveLength(3);
    domain.setFilter({ enabled: false, min: 1000, max: 2000 });
    expect(domain.getVisible(surface())).toHaveLength(3);
  });

  it("quarantines invalid placement after Surface terrain edits without data loss", () => {
    const domain = new UnderwaterDomainRegistry();
    const graph = surface();
    domain.upsert(marker(), graph);
    graph.cells.h[0] = 20;
    expect(domain.getVisible(graph)).toEqual([]);
    expect(domain.audit(graph)).toEqual([
      { i: 0, reason: "Underwater objects must lie entirely over Surface water cells." }
    ]);
    expect(domain.get(0)).toEqual(marker());
    graph.cells.h[0] = 19;
    expect(domain.audit(graph)).toEqual([]);
    expect(domain.getVisible(graph)).toHaveLength(1);
  });

  it("keeps faction membership within this domain", () => {
    const domain = new UnderwaterDomainRegistry();
    expect(() => domain.upsert(marker({ factionId: 4 }), surface())).toThrow(/reference/);
    domain.upsert(marker({ i: 4, kind: "faction", cells: [0, 1] }), surface());
    domain.upsert(marker({ factionId: 4 }), surface());
    expect(() => domain.remove(4)).toThrow(/Reassign/);
    domain.remove(0);
    expect(domain.remove(4)).toBe(true);
  });

  it("round-trips independent IDs, depth and filters through JSON", () => {
    const domain = new UnderwaterDomainRegistry();
    domain.upsert(marker(), surface());
    domain.setFilter({ enabled: true, min: 200, max: 800 });
    const restored = new UnderwaterDomainRegistry();
    restored.restore(JSON.parse(JSON.stringify(domain.state)));
    expect(restored.state).toEqual(domain.state);
    restored.reset();
    expect(restored.state.entities).toEqual([]);
    expect(restored.state.filter.enabled).toBe(false);
  });

  it("rejects malformed restored data atomically", () => {
    const domain = new UnderwaterDomainRegistry();
    domain.upsert(marker(), surface());
    for (const invalid of [null, { version: 2, entities: [] }, { version: 1, entities: [marker(), marker()] }]) {
      expect(() => domain.restore(invalid)).toThrow();
      expect(domain.get(0)).toEqual(marker());
    }
  });
});
