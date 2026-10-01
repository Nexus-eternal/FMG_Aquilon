// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { RealmData } from "@/components/realm-data";
import { validateBurgCell } from "@/components/underwater-native";
import { appendDepthFields } from "@/controllers/vertical-fields";
import type { PackedGraph } from "@/types/PackedGraph";

vi.mock("@/components/layers", () => ({ Layers: { draw: vi.fn() } }));
vi.mock("@/components/tooltips", () => ({ tip: vi.fn() }));

beforeEach(() => {
  RealmData.reset();
  document.body.innerHTML = '<div id="burgProperties"></div>';
  globalThis.pack = { cells: { h: [5, 25], burg: [1, 0] } } as unknown as PackedGraph;
});

it("edits native depth and rejects changing a water city to Surface without moving it", () => {
  const burg = { i: 1, cell: 0, depth: 500 };
  appendDepthFields(
    "burgProperties",
    burg,
    () => [burg.cell],
    () => validateBurgCell(pack, burg.cell, burg.depth, burg.i)
  );
  const depth = document.getElementById("burgPropertiesVerticalDepth") as HTMLInputElement;
  depth.value = "1500";
  depth.dispatchEvent(new Event("input"));
  expect(burg.depth).toBe(1500);
  const domain = document.getElementById("burgPropertiesVerticalDomain") as HTMLSelectElement;
  domain.value = "surface";
  domain.dispatchEvent(new Event("change"));
  expect(burg.depth).toBe(1500);
  expect(domain.value).toBe("underwater");
  depth.value = "-100";
  depth.dispatchEvent(new Event("change"));
  expect(burg.depth).toBe(1500);
});

it("supports zero depth and does not add Surface depth controls to Sky editors", () => {
  const marker = { depth: 500 };
  appendDepthFields("burgProperties", marker, () => [0]);
  const input = document.getElementById("burgPropertiesVerticalDepth") as HTMLInputElement;
  input.value = "0";
  input.dispatchEvent(new Event("input"));
  expect(marker.depth).toBe(0);
  document.getElementById("burgProperties")!.innerHTML = "";
  RealmData.setActive("sky");
  appendDepthFields("burgProperties", marker, () => [0]);
  expect(document.getElementById("burgProperties")!.children).toHaveLength(0);
});
