import type { Layer, LayerGroup, LayersRegistry } from "@/components/layers";

export interface LayerButton {
  label: string;
  shortcut?: string;
  hint?: string;
}

export function renderLayerTree<Id extends string>(
  tree: HTMLElement,
  layers: LayersRegistry<Id>,
  toggles: ReadonlyMap<Id, LayerButton>
): void {
  const renderedGroups = new Set<string>();
  const nodes: HTMLElement[] = [];

  for (const layer of layers.all) {
    const group = layers.getGroupForLayer(layer.id);
    if (!group) {
      const item = createLayerItem(layer, layers, toggles);
      if (item) nodes.push(item);
      continue;
    }
    if (renderedGroups.has(group.id)) continue;
    renderedGroups.add(group.id);
    nodes.push(createGroupItem(group, layers, toggles));
  }

  tree.replaceChildren(...nodes);
}

function createGroupItem<Id extends string>(
  group: LayerGroup<Id>,
  layers: LayersRegistry<Id>,
  toggles: ReadonlyMap<Id, LayerButton>
): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "layer-group";
  item.dataset.layerGroup = group.id;
  item.classList.toggle("collapsed", group.collapsed);
  item.classList.toggle("locked", group.locked);
  item.classList.toggle("buttonoff", !group.visible);

  const header = document.createElement("div");
  header.className = "layer-group-header";

  const collapse = createGroupButton("collapse", group.collapsed ? "▸" : "▾", "Collapse or expand realm");
  const title = document.createElement("strong");
  title.textContent = group.title;
  const visibility = createGroupButton("visibility", group.visible ? "◉" : "○", "Show or hide realm");
  const lock = createGroupButton("lock", group.locked ? "●" : "○", "Lock or unlock realm");
  lock.classList.add("layer-group-lock");
  const opacity = document.createElement("input");
  opacity.type = "range";
  opacity.min = "0";
  opacity.max = "1";
  opacity.step = "0.05";
  opacity.value = String(group.opacity);
  opacity.dataset.groupOpacity = "";
  opacity.title = `Realm opacity: ${Math.round(group.opacity * 100)}%`;
  opacity.disabled = group.locked;
  header.append(collapse, title, visibility, lock, opacity);

  const children = document.createElement("ul");
  children.className = "layer-group-layers";
  children.dataset.layerGroupChildren = group.id;
  children.hidden = group.collapsed;
  children.replaceChildren(
    ...group.layerIds.flatMap(id => {
      const layerItem = createLayerItem(layers.get(id), layers, toggles, group.locked);
      return layerItem ? [layerItem] : [];
    })
  );
  item.classList.toggle("solid", group.locked || group.layerIds.some(id => layers.get(id).parent !== "viewbox"));
  item.append(header, children);
  return item;
}

function createGroupButton(action: string, label: string, title: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.groupAction = action;
  button.textContent = label;
  button.title = title;
  return button;
}

function createLayerItem<Id extends string>(
  layer: Layer<Id>,
  layers: LayersRegistry<Id>,
  toggles: ReadonlyMap<Id, LayerButton>,
  locked = false
): HTMLLIElement | undefined {
  const metadata = layer.params.metadata;
  const button =
    toggles.get(layer.id) ?? (metadata && { label: metadata.title, shortcut: metadata.shortcut, hint: metadata.hint });
  if (!button) return;

  const item = document.createElement("li");
  item.dataset.layer = layer.id;
  item.dataset.tip = `${button.label.replace(/<\/?u>/g, "")}: click to toggle, drag to raise or lower the layer. Ctrl + click to edit layer style`;
  if (button.shortcut) item.dataset.shortcut = button.hint ?? button.shortcut.replace("Key", "");
  item.innerHTML = button.label;
  item.classList.toggle("buttonoff", !layers.isOn(layer.id));
  item.classList.toggle("locked", locked);
  item.classList.toggle("solid", locked || layer.params.parent !== "viewbox");
  return item;
}
