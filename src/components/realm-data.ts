import { applyRealmTerrain, captureRealmTerrain, type RealmTerrainData } from "@/components/realm-terrain";
import type { GridGraph } from "@/types/GridGraph";
import type { PackedGraph } from "@/types/PackedGraph";

export const REALM_DATA_VERSION = 2;

export interface RealmScopedData {
  burgs: PackedGraph["burgs"];
  markers: PackedGraph["markers"];
  routes: PackedGraph["routes"];
  zones: PackedGraph["zones"];
  addedLabels: PackedGraph["addedLabels"];
  cells: {
    burg: number[];
    routes: PackedGraph["cells"]["routes"];
  };
  terrain?: RealmTerrainData;
}

export interface RealmDataState {
  version: typeof REALM_DATA_VERSION;
  activeRealmId: string;
  realms: Record<string, RealmScopedData>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function capture(graph: PackedGraph, terrainGraph?: GridGraph, previous?: RealmScopedData): RealmScopedData {
  return {
    burgs: clone(graph.burgs),
    markers: clone(graph.markers),
    routes: clone(graph.routes),
    zones: clone(graph.zones),
    addedLabels: clone(graph.addedLabels),
    cells: {
      burg: Array.from(graph.cells.burg),
      routes: clone(graph.cells.routes)
    },
    terrain: terrainGraph ? captureRealmTerrain(terrainGraph) : previous?.terrain
  };
}

function isRealmDataState(value: unknown): value is RealmDataState {
  if (!value || typeof value !== "object") return false;
  const state = value as { version?: unknown; activeRealmId?: unknown; realms?: unknown };
  return (
    (state.version === 1 || state.version === REALM_DATA_VERSION) &&
    typeof state.activeRealmId === "string" &&
    Boolean(state.realms) &&
    typeof state.realms === "object" &&
    !Array.isArray(state.realms)
  );
}

export class RealmDataRegistry {
  private activeRealmId = "surface";
  private realms = new Map<string, RealmScopedData>();

  get active(): string {
    return this.activeRealmId;
  }

  get state(): RealmDataState {
    return {
      version: REALM_DATA_VERSION,
      activeRealmId: this.activeRealmId,
      realms: Object.fromEntries(Array.from(this.realms, ([id, data]) => [id, clone(data)]))
    };
  }

  has(id: string): boolean {
    return this.realms.has(id);
  }

  get(id: string): RealmScopedData {
    const data = this.realms.get(id);
    if (!data) throw new Error(`Realm data ${id} is not registered`);
    return clone(data);
  }

  save(id: string, graph: PackedGraph, terrainGraph?: GridGraph): void {
    if (!id) throw new Error("Realm id cannot be empty");
    this.realms.set(id, capture(graph, terrainGraph, this.realms.get(id)));
  }

  hasTerrain(id: string): boolean {
    return Boolean(this.realms.get(id)?.terrain);
  }

  applyTerrain(id: string, graph: GridGraph): void {
    const terrain = this.realms.get(id)?.terrain;
    if (!terrain) throw new Error(`Realm terrain ${id} is not registered`);
    applyRealmTerrain(graph, terrain);
  }

  activate(id: string, graph: PackedGraph): void {
    const data = this.realms.get(id);
    if (!data) throw new Error(`Realm data ${id} is not registered`);

    graph.burgs = clone(data.burgs);
    graph.markers = clone(data.markers);
    graph.routes = clone(data.routes);
    graph.zones = clone(data.zones);
    graph.addedLabels = clone(data.addedLabels);
    graph.cells.burg = Uint16Array.from(data.cells.burg);
    graph.cells.routes = clone(data.cells.routes);
    this.activeRealmId = id;
  }

  setActive(id: string): void {
    if (!id) throw new Error("Realm id cannot be empty");
    this.activeRealmId = id;
  }

  reset(activeRealmId = "surface"): void {
    this.realms.clear();
    this.activeRealmId = activeRealmId;
  }

  restore(value: unknown): void {
    this.reset();
    if (!isRealmDataState(value)) return;

    this.activeRealmId = value.activeRealmId;
    for (const [id, data] of Object.entries(value.realms)) {
      if (!id || !data || typeof data !== "object") continue;
      this.realms.set(id, clone(data));
    }
  }
}

export const RealmData = new RealmDataRegistry();

declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for extensions and test automation
  var RealmData: RealmDataRegistry;
}
globalThis.RealmData = RealmData;
