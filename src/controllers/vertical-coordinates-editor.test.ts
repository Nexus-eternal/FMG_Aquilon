// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { RealmData } from "@/components/realm-data";
import { drawVerticalFilter } from "@/renderers/draw-vertical-filter";
import type { PackedGraph } from "@/types/PackedGraph";
import { installVerticalCoordinatesEditor, refreshVerticalCoordinatesEditor } from "./vertical-coordinates-editor";

beforeEach(() => {
  document.body.innerHTML = `<div id="panel"></div><svg id="map"><defs><path id="feature_1" d="M0,0L10,0L10,10Z"/><path id="feature_2" d="M20,20L30,20L30,30Z"/></defs><g id="landmass"/><g id="markers"><svg id="marker0"/><svg id="marker1"/></g></svg>`;
  globalThis.pack = {
    cells: { f: [1, 2], burg: [], routes: {} },
    features: [0, { i: 1, name: "Low island", land: true }, { i: 2, name: "High island", land: true, altitude: 3200 }],
    burgs: [],
    markers: [
      { i: 0, cell: 0, name: "Low point" },
      { i: 1, cell: 1, name: "High point" }
    ],
    routes: [],
    zones: [],
    addedLabels: []
  } as unknown as PackedGraph;
  RealmData.reset();
  RealmData.save("sky", pack);
  RealmData.setActive("sky");
  installVerticalCoordinatesEditor(document.getElementById("panel")!, () => RealmData.save("sky", pack));
});

describe("Sky altitude controls", () => {
  it("edits an island and filters its inherited points without deleting data", () => {
    const input = document.getElementById("realmVerticalAltitude") as HTMLInputElement;
    input.value = "1800";
    input.dispatchEvent(new Event("input"));
    expect(pack.features[1].altitude).toBe(1800);
    const maximum = document.getElementById("realmVerticalMax") as HTMLInputElement;
    maximum.value = "2000";
    maximum.dispatchEvent(new Event("input"));
    const enabled = document.getElementById("realmVerticalEnabled") as HTMLInputElement;
    enabled.checked = true;
    enabled.dispatchEvent(new Event("input"));
    expect(document.querySelectorAll("#realmVerticalClip path")).toHaveLength(1);
    const css = document.getElementById("realmVerticalStyle")!.textContent;
    expect(css).toContain("#marker1");
    expect(css).not.toContain("#marker0");
    expect(pack.markers).toHaveLength(2);
    expect(RealmData.get("sky").featureCoordinates?.[1].altitude).toBe(1800);
    RealmData.setActive("surface");
    drawVerticalFilter();
    refreshVerticalCoordinatesEditor();
    expect(document.getElementById("realmVerticalStyle")!.textContent).toBe("");
    expect(document.getElementById("realmVerticalBody")!.hidden).toBe(true);
  });

  it("handles empty ranges, redraws, and resetting an override to inheritance", () => {
    RealmData.setVerticalFilter("sky", { enabled: true, min: 5000, max: 6000 });
    drawVerticalFilter();
    expect(document.querySelectorAll("#realmVerticalClip path")).toHaveLength(0);
    RealmData.setVerticalFilter("sky", { enabled: false, min: 5000, max: 6000 });
    drawVerticalFilter();
    expect(document.getElementById("realmVerticalStyle")!.textContent).toBe("");
    const select = document.getElementById("realmVerticalObject") as HTMLSelectElement;
    select.value = "island:2";
    select.dispatchEvent(new Event("change"));
    const input = document.getElementById("realmVerticalAltitude") as HTMLInputElement;
    input.value = "";
    input.dispatchEvent(new Event("input"));
    expect(pack.features[2].altitude).toBeUndefined();
  });
});
