import { RealmData } from "@/components/realm-data";
import { validateWaterRoute } from "@/components/underwater-native";
import { validateUnderwaterPlacement } from "@/components/vertical-coordinates";
import type { PackedGraph } from "@/types/PackedGraph";

/** Convert the prototype's annotations to native entities, atomically and only once. */
export function migrateUnderwaterAnnotations(): number {
  const legacy = RealmData.underwater.state;
  if (!legacy.entities.length || RealmData.active !== "surface") return 0;
  const backup = structuredClone(pack);
  const stateIds = new Map<number, number>();
  const burgIds = new Map<number, number>();
  const mapped = (cells: number[]) => [
    ...new Set(
      cells.map(cell => {
        const point = grid.points[cell];
        if (!point) throw new Error("Legacy Underwater cell no longer exists.");
        const id = Pack.findCell(point[0], point[1]);
        if (id === undefined) throw new Error("Legacy Underwater object lies outside the map.");
        return id;
      })
    )
  ];
  try {
    for (const entity of legacy.entities.filter(e => e.kind === "settlement")) {
      const cell = mapped(entity.cells)[0];
      validateUnderwaterPlacement(entity.depth, [cell], pack.cells.h);
      const id = Burgs.add(pack.cells.p[cell], { depth: entity.depth });
      pack.burgs[id].name = entity.name;
      burgIds.set(entity.i, id);
    }
    for (const entity of legacy.entities.filter(e => e.kind === "faction")) {
      const cells = mapped(entity.cells);
      validateUnderwaterPlacement(entity.depth, cells, pack.cells.h);
      const member = legacy.entities.find(e => e.kind === "settlement" && e.factionId === entity.i);
      const capital = member
        ? burgIds.get(member.i)!
        : pack.cells.burg[cells[0]] || Burgs.add(pack.cells.p[cells[0]], { depth: entity.depth });
      const burg = pack.burgs[capital];
      const id = pack.states.length;
      const diplomacy = pack.states.map(s => (s.i && !s.removed ? "Neutral" : "x"));
      diplomacy.push("x");
      for (const state of pack.states) if (state.i && !state.removed) state.diplomacy?.push("Neutral");
      pack.states.push({
        i: id,
        name: entity.name,
        fullName: entity.name,
        environment: "underwater",
        form: "Union",
        formName: "League",
        capital,
        center: burg.cell,
        culture: burg.culture ?? 0,
        coa: structuredClone(burg.coa!),
        color: "#7957a5",
        type: "Naval",
        expansionism: 0.5,
        diplomacy,
        provinces: [],
        military: [],
        salesTax: 0,
        pollTax: 0,
        treasury: 0,
        lock: true
      });
      for (const cell of cells) pack.cells.state[cell] = id;
      pack.cells.state[burg.cell] = id;
      burg.state = id;
      burg.capital = 1;
      Burgs.changeGroup(burg);
      stateIds.set(entity.i, id);
    }
    for (const entity of legacy.entities) {
      const cells = mapped(entity.cells);
      validateUnderwaterPlacement(entity.depth, cells, pack.cells.h);
      if (entity.kind === "settlement") {
        const burg = pack.burgs[burgIds.get(entity.i)!];
        if (entity.factionId !== undefined) {
          burg.state = stateIds.get(entity.factionId)!;
          pack.cells.state[burg.cell] = burg.state;
        }
      } else if (entity.kind === "marker") {
        const [x, y] = pack.cells.p[cells[0]];
        Markers.add({
          i: 0,
          cell: cells[0],
          x,
          y,
          name: entity.name,
          type: "underwater",
          icon: "⚓",
          depth: entity.depth
        });
      } else if (entity.kind === "zone") {
        const i = Math.max(-1, ...pack.zones.map(z => z.i)) + 1;
        pack.zones.push({ i, name: entity.name, type: "Underwater", color: "#60cfc9", cells, depth: entity.depth });
      } else if (entity.kind === "route") {
        const points = entity.cells.map(cell => {
          const [x, y] = grid.points[cell];
          return [x, y, Pack.findCell(x, y)!];
        });
        validateWaterRoute(points, entity.depth);
        const i = Routes.getNextId();
        pack.routes.push({
          i,
          group: "searoutes",
          feature: pack.cells.f[cells[0]],
          name: entity.name,
          depth: entity.depth,
          points
        });
        for (let index = 1; index < points.length; index++) {
          const a = points[index - 1][2],
            b = points[index][2];
          if (a === b) continue;
          pack.cells.routes[a] ??= {};
          pack.cells.routes[b] ??= {};
          pack.cells.routes[a][b] = i;
          pack.cells.routes[b][a] = i;
        }
      }
    }
    States.collectStatistics();
    States.getPoles();
    RealmData.underwater.restore({ ...legacy, entities: [] });
    RealmData.save("surface", pack);
    return legacy.entities.length;
  } catch (error) {
    Object.assign(pack, backup as PackedGraph);
    RealmData.underwater.restore(legacy);
    throw error;
  }
}
