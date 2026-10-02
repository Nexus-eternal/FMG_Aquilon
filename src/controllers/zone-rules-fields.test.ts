// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Zone } from "@/generators/zones-generator";
import { editZoneRules } from "./zone-rules-fields";

const mocks = vi.hoisted(() => ({ promote: vi.fn(), tip: vi.fn() }));
vi.mock("@/components/realm-data", () => ({ RealmData: { active: "surface", promoteZone: mocks.promote } }));
vi.mock("@/components/tooltips", () => ({ tip: mocks.tip }));
vi.mock("@/utils", () => ({ ensureEl: (id: string) => document.getElementById(id)! }));

describe("native zone rules form", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="zonesRules" hidden></div>';
    vi.stubGlobal("pack", {});
    vi.clearAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());
  const input = (id: string) => document.getElementById(id) as HTMLInputElement;
  const makeZone = (): Zone => ({ i: 0, name: "Storm", type: "Weather", color: "#fff", cells: [] });
  const submit = () =>
    document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  it("uses visible native checkbox styling and accepts common multiplier values", () => {
    editZoneRules(makeZone(), vi.fn());
    expect(document.getElementById("zonesRules")!.hidden).toBe(false);
    for (const checkbox of document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
      expect(checkbox.classList.contains("native")).toBe(true);
    input("zoneRulesMovement").value = "0.5";
    expect(input("zoneRulesMovement").validity.valid).toBe(true);
    input("zoneRulesMovement").value = "1";
    expect(input("zoneRulesMovement").validity.valid).toBe(true);
  });
  it("rejects invalid scope without changing the zone or promoting its footprint", () => {
    const zone = makeZone(),
      changed = vi.fn();
    editZoneRules(zone, changed);
    for (const checkbox of document.querySelectorAll<HTMLInputElement>("[data-environment]")) checkbox.checked = false;
    submit();
    expect(zone.rules).toBeUndefined();
    expect(mocks.promote).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    expect(mocks.tip).toHaveBeenCalledWith("Select at least one environment.", false, "error");
  });
  it("applies rules once and preserves the native zone identity and note", () => {
    const zone = { ...makeZone(), note: "Keep this native note" },
      changed = vi.fn();
    editZoneRules(zone, changed);
    input("zoneRulesMovement").value = "0.5";
    input("zoneRulesRequirements").value = "Mask; Mask; Shield";
    submit();
    expect(mocks.promote).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalledOnce();
    expect(zone.rules?.requirements).toEqual(["Mask", "Shield"]);
    expect(zone.rules?.movement).toBe(0.5);
    expect(zone.note).toBe("Keep this native note");
  });
});
