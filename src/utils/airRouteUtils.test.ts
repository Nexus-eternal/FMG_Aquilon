import { expect, test } from "vitest";
import { getAirRoutePath as airRoutePath } from "./airRouteUtils";

test("a bounded arc keeps exact endpoints and visits manual control points", () => {
  expect(
    airRoutePath([
      [0, 0],
      [100, 0],
      [200, 100]
    ])
  ).toMatch(/^M0,0Q50,12,100,0Q/);
  expect(
    airRoutePath([
      [0, 0],
      [10000, 0]
    ])
  ).toBe("M0,0Q5000,40,10000,0");
});
test("coincident endpoints stay finite", () => {
  expect(
    airRoutePath([
      [10, 20],
      [10, 20]
    ])
  ).toBe("M10,20Q10,20,10,20");
  expect(airRoutePath([])).toBe("");
});
