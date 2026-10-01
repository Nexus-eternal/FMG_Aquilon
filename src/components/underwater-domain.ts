import type { GridGraph } from "@/types/GridGraph";
import {
  DEFAULT_VERTICAL_FILTER,
  isInVerticalRange,
  normalizeVerticalFilter,
  type VerticalFilter,
  validateUnderwaterPlacement
} from "./vertical-coordinates";

export type UnderwaterEntityKind = "settlement" | "marker" | "route" | "zone" | "faction";

export interface UnderwaterEntity {
  i: number;
  kind: UnderwaterEntityKind;
  name: string;
  depth: number;
  cells: number[]; // canonical Surface grid IDs, never packed or Sky cell IDs
  factionId?: number;
}

export interface UnderwaterDomainState {
  version: 1;
  entities: UnderwaterEntity[];
  filter: VerticalFilter;
}

export interface UnderwaterPlacementIssue {
  i: number;
  reason: string;
}

const KINDS: readonly UnderwaterEntityKind[] = ["settlement", "marker", "route", "zone", "faction"];

function validateEntity(value: unknown): asserts value is UnderwaterEntity {
  if (!value || typeof value !== "object") throw new Error("Invalid Underwater entity.");
  const entity = value as UnderwaterEntity;
  if (!Number.isSafeInteger(entity.i) || entity.i < 0 || !KINDS.includes(entity.kind)) {
    throw new Error("Invalid Underwater entity id or kind.");
  }
  if (typeof entity.name !== "string" || !Array.isArray(entity.cells) || !entity.cells.length) {
    throw new Error("Underwater entities require a name and a cell footprint.");
  }
  if (entity.cells.some(cell => !Number.isSafeInteger(cell) || cell < 0)) {
    throw new Error("Invalid Surface grid cell id.");
  }
  if (entity.kind !== "route" && new Set(entity.cells).size !== entity.cells.length) {
    throw new Error("Duplicate Surface grid cells.");
  }
  if ((entity.kind === "settlement" || entity.kind === "marker") && entity.cells.length !== 1) {
    throw new Error("Point entities require exactly one Surface grid cell.");
  }
  if (entity.kind === "route" && entity.cells.length < 2) throw new Error("Routes require at least two cells.");
  if (!Number.isFinite(entity.depth) || entity.depth < 0) throw new Error("Invalid depth in metres.");
  if (entity.factionId !== undefined && (!Number.isSafeInteger(entity.factionId) || entity.factionId < 0)) {
    throw new Error("Invalid Underwater faction id.");
  }
}

function validatePlacement(entity: UnderwaterEntity, surface: GridGraph): void {
  validateUnderwaterPlacement(entity.depth, entity.cells, surface.cells.h);
  if (entity.kind === "route") {
    for (let index = 1; index < entity.cells.length; index++) {
      const previous = entity.cells[index - 1];
      if (!surface.cells.c[previous]?.includes(entity.cells[index])) {
        throw new Error("Underwater routes must follow adjacent Surface water cells.");
      }
    }
  }
}

function validateFactions(entities: UnderwaterEntity[]): void {
  const factions = new Set(entities.filter(entity => entity.kind === "faction").map(entity => entity.i));
  if (entities.some(entity => entity.factionId !== undefined && !factions.has(entity.factionId))) {
    throw new Error("Underwater faction reference does not exist.");
  }
}

function copyEntity(entity: UnderwaterEntity): UnderwaterEntity {
  return {
    i: entity.i,
    kind: entity.kind,
    name: entity.name,
    depth: entity.depth,
    cells: [...entity.cells],
    ...(entity.factionId === undefined ? {} : { factionId: entity.factionId })
  };
}

export class UnderwaterDomainRegistry {
  private entities = new Map<number, UnderwaterEntity>();
  private filter = { ...DEFAULT_VERTICAL_FILTER };

  get state(): UnderwaterDomainState {
    return { version: 1, entities: structuredClone([...this.entities.values()]), filter: { ...this.filter } };
  }

  get(i: number): UnderwaterEntity | undefined {
    const entity = this.entities.get(i);
    return entity ? structuredClone(entity) : undefined;
  }

  upsert(entity: UnderwaterEntity, surface: GridGraph): void {
    validateEntity(entity);
    validatePlacement(entity, surface);
    const next = new Map(this.entities);
    next.set(entity.i, copyEntity(entity));
    validateFactions([...next.values()]);
    this.entities = next;
  }

  remove(i: number): boolean {
    if ([...this.entities.values()].some(entity => entity.factionId === i && entity.i !== i)) {
      throw new Error("Reassign faction members before removing their faction.");
    }
    return this.entities.delete(i);
  }

  setFilter(filter: VerticalFilter): void {
    if (!Number.isFinite(filter.min) || !Number.isFinite(filter.max)) throw new Error("Invalid depth range.");
    this.filter = normalizeVerticalFilter(filter);
  }

  getVisible(surface: GridGraph): UnderwaterEntity[] {
    return [...this.entities.values()]
      .filter(entity => {
        if (!isInVerticalRange(entity.depth, this.filter)) return false;
        try {
          validatePlacement(entity, surface);
          return true;
        } catch {
          return false;
        }
      })
      .map(entity => structuredClone(entity));
  }

  audit(surface: GridGraph): UnderwaterPlacementIssue[] {
    return [...this.entities.values()].flatMap(entity => {
      try {
        validatePlacement(entity, surface);
        return [];
      } catch (error) {
        return [{ i: entity.i, reason: error instanceof Error ? error.message : "Invalid placement" }];
      }
    });
  }

  reset(): void {
    this.entities.clear();
    this.filter = { ...DEFAULT_VERTICAL_FILTER };
  }

  restore(value: unknown): void {
    if (!value || typeof value !== "object") throw new Error("Invalid Underwater domain state.");
    const state = value as UnderwaterDomainState;
    if (state.version !== 1 || !Array.isArray(state.entities)) throw new Error("Unsupported Underwater domain state.");
    const next = new Map<number, UnderwaterEntity>();
    for (const entity of state.entities) {
      validateEntity(entity);
      if (next.has(entity.i)) throw new Error("Duplicate Underwater entity id.");
      next.set(entity.i, copyEntity(entity));
    }
    validateFactions([...next.values()]);
    const filter = normalizeVerticalFilter(state.filter);
    this.entities = next;
    this.filter = filter;
  }
}
