import fs from "fs";
import { expect, test } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

test("realm-scoped entities survive a .map save and load", async ({ page }) => {
  await page.goto("/?seed=realm-data-round-trip&width=1280&height=720");
  await waitForMap(page);

  await page.evaluate(() => {
    RealmData.save("surface", pack);

    pack.markers = [{ i: 901, x: 100, y: 120, type: "cloud", name: "Saved Sky Marker" }];
    pack.routes = [];
    pack.zones = [];
    pack.addedLabels = [];
    pack.burgs = [0] as unknown as typeof pack.burgs;
    pack.cells.burg = new Uint16Array(pack.cells.i.length);
    pack.cells.routes = {};
    RealmData.save("sky", pack);
    RealmData.activate("surface", pack);
  });

  const downloadPromise = page.waitForEvent("download");
  await page.evaluate(() => Services.Save.toMachine());
  const download = await downloadPromise;
  const buffer = fs.readFileSync(await download.path());
  const savedRealmState = JSON.parse(buffer.toString("utf8").split("\r\n")[53]);
  expect(savedRealmState.realms.sky.markers[0].name).toBe("Saved Sky Marker");

  await page.goto("/?seed=other-realm-data-map&width=1280&height=720");
  await waitForMap(page);
  await page.locator("#mapToLoad").setInputFiles({ name: "realm-data.map", mimeType: "text/plain", buffer });
  await expect(page.locator("#tooltip")).toContainText("Map is successfully loaded", { timeout: 120000 });

  const restored = await page.evaluate(async () => {
    const currentMapData = await Services.Save.prepareMapData();
    const persistedBySaveService = JSON.parse(currentMapData.split("\r\n")[53]);
    return {
      active: RealmData.active,
      surface: RealmData.has("surface"),
      skyMarker: RealmData.has("sky") ? RealmData.get("sky").markers[0] : null,
      persistedBySaveService
    };
  });

  expect(restored.persistedBySaveService.realms.sky.markers[0].name).toBe("Saved Sky Marker");
  expect(restored.active).toBe("surface");
  expect(restored.surface).toBe(true);
  expect(restored.skyMarker).toMatchObject({ i: 901, name: "Saved Sky Marker" });
});

test("the Sky Realm demo restores edits into its regenerated world", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto("/?realmDemo=1&seed=realm-demo-round-trip&width=1280&height=720");
  await waitForMap(page);
  await expect(page.locator("#realmDemoStatus")).toContainText("standard Tools menu", { timeout: 120000 });

  await page.locator("#realmDemoSwitch").evaluate(button => button.click());
  await expect(page.locator("#realmDemoStatus")).toContainText("Editing Sky Realm");
  const markerId = await page.evaluate(() => {
    const marker = pack.markers[0] ?? { i: 901, x: 100, y: 120, type: "cloud" };
    if (!pack.markers.length) pack.markers.push(marker as (typeof pack.markers)[number]);
    marker.name = "Persistent Cloud Citadel";
    grid.cells.temp[0] = 99;
    return marker.i;
  });

  const downloadPromise = page.waitForEvent("download");
  await page.evaluate(() => Services.Save.toMachine());
  const download = await downloadPromise;
  const buffer = fs.readFileSync(await download.path());
  const savedRealmState = JSON.parse(buffer.toString("utf8").split("\r\n")[53]);
  expect(savedRealmState.realms.sky.markers[0].name).toBe("Persistent Cloud Citadel");
  await expect(page.locator("#realmDemoStatus")).toContainText("Editing Sky Realm");
  await expect(page.locator("#realmDemoSwitch")).toHaveText("Return to Surface");

  await page.goto("/?realmDemo=1&seed=other-realm-demo-map&width=1280&height=720");
  await waitForMap(page);
  await expect(page.locator("#realmDemoStatus")).toContainText("standard Tools menu", { timeout: 120000 });
  await page.locator("#mapToLoad").setInputFiles({ name: "realm-demo.map", mimeType: "text/plain", buffer });
  await expect(page.locator("#tooltip")).toContainText("Map is successfully loaded", { timeout: 120000 });
  await expect(page.locator("#realmDemoStatus")).toContainText("standard Tools menu", { timeout: 120000 });

  await page.locator("#realmDemoSwitch").evaluate(button => button.click());
  await expect
    .poll(() => page.evaluate(id => pack.markers.find(marker => marker.i === id)?.name, markerId))
    .toBe("Persistent Cloud Citadel");
  expect(await page.evaluate(() => grid.cells.temp[0])).toBe(99);
});
