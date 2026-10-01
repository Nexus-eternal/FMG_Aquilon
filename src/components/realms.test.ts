// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { Layer, LayersRegistry } from "./layers";
import { RealmsRegistry } from "./realms";

let layers: LayersRegistry;
let realms: RealmsRegistry;

beforeEach(() => {
  document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox"></g></svg>`;
  layers = new LayersRegistry([
    new Layer({ id: "surface", element: "surface-el", parent: "viewbox" }),
    new Layer({ id: "sky", element: "sky-el", parent: "viewbox", keepContent: true })
  ]);
  layers.init();
  realms = new RealmsRegistry(layers);
});

describe("RealmsRegistry", () => {
  it("registers a realm as a layer group", () => {
    const realm = realms.register({
      id: "sky",
      title: "Sky Realm",
      visible: true,
      opacity: 0.7,
      locked: false,
      layerIds: ["sky"]
    });

    expect(realms.all).toEqual([realm]);
    expect(realm.definition).toEqual({
      id: "sky",
      title: "Sky Realm",
      visible: true,
      opacity: 0.7,
      locked: false,
      layerIds: ["sky"]
    });
    expect(document.getElementById("sky-el")!.parentElement!.id).toBe("layer-group-realm-sky");
  });

  it("updates visibility, opacity and locking through the layer group", () => {
    const realm = realms.register({
      id: "sky",
      title: "Sky Realm",
      visible: true,
      opacity: 1,
      locked: false,
      layerIds: ["sky"]
    });

    realms.setVisibility("sky", false);
    realms.setOpacity("sky", 0.35);
    realms.setLocked("sky", true);

    const element = document.getElementById("layer-group-realm-sky")!;
    expect(realm.visible).toBe(false);
    expect(realm.opacity).toBe(0.35);
    expect(realm.locked).toBe(true);
    expect(element.style.display).toBe("none");
    expect(element.getAttribute("opacity")).toBe("0.35");
  });

  it("unregisters the realm and unwraps its layers", () => {
    realms.register({
      id: "sky",
      title: "Sky Realm",
      visible: true,
      opacity: 1,
      locked: false,
      layerIds: ["sky"]
    });

    expect(realms.unregister("sky")).toBe(true);
    expect(realms.has("sky")).toBe(false);
    expect(document.getElementById("sky-el")!.parentElement!.id).toBe("viewbox");
    expect(document.getElementById("layer-group-realm-sky")).toBeNull();
    expect(realms.unregister("sky")).toBe(false);
  });

  it("rejects duplicate realms and unknown layers", () => {
    const definition = {
      id: "sky",
      title: "Sky Realm",
      visible: true,
      opacity: 1,
      locked: false,
      layerIds: ["sky"]
    };
    realms.register(definition);

    expect(() => realms.register(definition)).toThrow("already registered");
    expect(() => realms.register({ ...definition, id: "unknown", layerIds: ["missing"] })).toThrow("not registered");
  });

  it("accepts layers registered dynamically by an extension", () => {
    layers.register({ id: "clouds", element: "clouds-el", parent: "viewbox" });

    realms.register({
      id: "sky",
      title: "Sky Realm",
      visible: true,
      opacity: 1,
      locked: false,
      layerIds: ["sky", "clouds"]
    });

    expect(realms.get("sky").layerIds).toEqual(["sky", "clouds"]);
  });
});
