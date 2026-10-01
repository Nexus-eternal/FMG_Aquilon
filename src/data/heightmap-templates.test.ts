import { describe, expect, it } from "vitest";
import { heightmapTemplates } from "./heightmap-templates";

describe("World Map heightmap template", () => {
  it("finishes with guaranteed ocean borders", () => {
    const steps = heightmapTemplates.worldMap.template.trim().split("\n");

    expect(steps.at(-2)?.trim()).toBe("Mask 1 0 0 0");
    expect(steps.at(-1)?.trim()).toBe("PolarOcean 10 5 smoothstep 0");
    expect(heightmapTemplates.worldMap.probability).toBe(0);
  });
});
