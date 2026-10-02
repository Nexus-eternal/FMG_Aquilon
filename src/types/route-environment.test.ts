import { expect, test } from "vitest";
import { getRouteEnvironment } from "./route-environment";

test("legacy roads and explicit zero-depth underwater routes retain their semantics", () => {
  expect(getRouteEnvironment({})).toBe("surface");
  expect(getRouteEnvironment({ depth: 0 })).toBe("underwater");
  expect(getRouteEnvironment({ environment: "underground", depth: 700 })).toBe("underground");
});
