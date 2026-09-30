import { type LayerGroup, Layers, type LayersRegistry } from "./layers";

export interface RealmDefinition {
  id: string;
  title: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
  layerIds: string[];
}

export class Realm<LayerId extends string = string> {
  readonly id: string;
  readonly title: string;
  readonly layerIds: readonly LayerId[];

  constructor(
    definition: RealmDefinition,
    private readonly group: LayerGroup<LayerId>
  ) {
    this.id = definition.id;
    this.title = definition.title;
    this.layerIds = group.layerIds;
  }

  get visible(): boolean {
    return this.group.visible;
  }

  get opacity(): number {
    return this.group.opacity;
  }

  get locked(): boolean {
    return this.group.locked;
  }

  get definition(): RealmDefinition {
    return {
      id: this.id,
      title: this.title,
      visible: this.visible,
      opacity: this.opacity,
      locked: this.locked,
      layerIds: [...this.layerIds]
    };
  }
}

export class RealmsRegistry<LayerId extends string = string> {
  private realms: Realm<LayerId>[] = [];

  constructor(private readonly layers: LayersRegistry<LayerId>) {}

  get all(): readonly Realm<LayerId>[] {
    return this.realms;
  }

  has(id: string): boolean {
    return this.realms.some(realm => realm.id === id);
  }

  get(id: string): Realm<LayerId> {
    const realm = this.realms.find(realm => realm.id === id);
    if (!realm) throw new Error(`Realm ${id} is not registered`);
    return realm;
  }

  register(definition: RealmDefinition): Realm<LayerId> {
    if (this.has(definition.id)) throw new Error(`Realm ${definition.id} is already registered`);

    const group = this.layers.createGroup({
      id: this.getGroupId(definition.id),
      title: definition.title,
      layers: definition.layerIds,
      visible: definition.visible,
      opacity: definition.opacity,
      locked: definition.locked
    });
    const realm = new Realm(definition, group);
    this.realms.push(realm);
    return realm;
  }

  unregister(id: string): boolean {
    const index = this.realms.findIndex(realm => realm.id === id);
    if (index === -1) return false;

    this.realms.splice(index, 1);
    this.layers.removeGroup(this.getGroupId(id));
    return true;
  }

  setVisibility(id: string, visible: boolean): void {
    this.get(id);
    this.layers.setGroupVisibility(this.getGroupId(id), visible);
  }

  setOpacity(id: string, opacity: number): void {
    this.get(id);
    this.layers.setGroupOpacity(this.getGroupId(id), opacity);
  }

  setLocked(id: string, locked: boolean): void {
    this.get(id);
    this.layers.setGroupLocked(this.getGroupId(id), locked);
  }

  private getGroupId(id: string): string {
    return `realm-${id}`;
  }
}

export const Realms = new RealmsRegistry(Layers);
