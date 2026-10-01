import { describe, expect, it } from "vitest";
import { createRealmCloudSvg } from "./realm-clouds";

const defaults = {
  width: 1000,
  height: 500,
  seed: 42,
  density: 0.85,
  groundVisibility: 0.65,
  editorClouds: false
};

describe("createRealmCloudSvg", () => {
  it("uses stitched multi-scale fractal noise", () => {
    const svg = createRealmCloudSvg(defaults);

    expect(svg.match(/stitchTiles="stitch"/g)).toHaveLength(2);
    expect(svg.includes('numOctaves="5"')).toBe(true);
    expect(svg.includes('numOctaves="4"')).toBe(true);
    expect(svg.includes('edgeMode="wrap"')).toBe(true);
  });

  it("removes clouds completely at zero density", () => {
    const svg = createRealmCloudSvg({ ...defaults, density: 0 });

    expect(svg.includes("cloud-noise")).toBe(false);
    expect(svg.includes("feTurbulence")).toBe(false);
  });

  it("keeps the editor ground veil independent from cloud density", () => {
    const svg = createRealmCloudSvg({ ...defaults, density: 0, editorClouds: true });

    expect(svg.includes('fill="#b9d3eb"')).toBe(true);
    expect(svg.includes('fill-opacity="0.350"')).toBe(true);
  });
});
