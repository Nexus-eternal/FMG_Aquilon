// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { Layer, LayersRegistry } from "@/components/layers";
import { type LayerButton, renderLayerTree } from "./layer-tree";

let layers: LayersRegistry;
let tree: HTMLElement;
const toggles = new Map<string, LayerButton>([
  ["surface", { label: "Surface" }],
  ["islands", { label: "Islands", shortcut: "KeyI" }],
  ["labels", { label: "Labels" }]
]);

beforeEach(() => {
  document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox"></g></svg><ul id="tree"></ul>`;
  tree = document.getElementById("tree")!;
  layers = new LayersRegistry([
    new Layer({ id: "surface", parent: "viewbox" }),
    new Layer({ id: "islands", parent: "viewbox" }),
    new Layer({ id: "labels", parent: "viewbox" })
  ]);
  layers.init();
});

describe("renderLayerTree", () => {
  it("renders ungrouped layers at the world level", () => {
    renderLayerTree(tree, layers, toggles);

    expect(Array.from(tree.children, item => (item as HTMLElement).dataset.layer)).toEqual([
      "surface",
      "islands",
      "labels"
    ]);
  });

  it("renders a realm group and its layers in registry order", () => {
    layers.createGroup({ id: "realm-sky", title: "Sky", layers: ["islands", "labels"], opacity: 0.65 });
    renderLayerTree(tree, layers, toggles);

    const group = tree.querySelector<HTMLElement>("[data-layer-group='realm-sky']")!;
    expect(Array.from(tree.children, item => (item as HTMLElement).dataset.layer ?? "group")).toEqual([
      "surface",
      "group"
    ]);
    expect(group.querySelector("strong")!.textContent).toBe("Sky");
    expect(Array.from(group.querySelectorAll<HTMLElement>("[data-layer]"), item => item.dataset.layer)).toEqual([
      "islands",
      "labels"
    ]);
    expect(group.querySelector<HTMLInputElement>("[data-group-opacity]")!.value).toBe("0.65");
  });

  it("projects collapsed, hidden and locked group state", () => {
    layers.createGroup({
      id: "realm-sky",
      title: "Sky",
      layers: ["islands", "labels"],
      visible: false,
      locked: true,
      collapsed: true
    });
    renderLayerTree(tree, layers, toggles);

    const group = tree.querySelector<HTMLElement>("[data-layer-group='realm-sky']")!;
    expect(group.classList).toContain("collapsed");
    expect(group.classList).toContain("buttonoff");
    expect(group.classList).toContain("locked");
    expect(group.querySelector("ul")!.hidden).toBe(true);
    expect(group.querySelector<HTMLInputElement>("[data-group-opacity]")!.disabled).toBe(true);
    expect(group.querySelectorAll("li.locked")).toHaveLength(2);
  });

  it("uses metadata to display dynamically registered layers", () => {
    layers.register({
      id: "clouds",
      parent: "viewbox",
      metadata: { title: "Clouds", shortcut: "KeyC" }
    });
    renderLayerTree(tree, layers, toggles);

    const item = tree.querySelector<HTMLElement>("[data-layer='clouds']")!;
    expect(item.textContent).toBe("Clouds");
    expect(item.dataset.shortcut).toBe("C");
  });
});
