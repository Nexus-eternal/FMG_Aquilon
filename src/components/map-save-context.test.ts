import { describe, expect, it, vi } from "vitest";
import { MapSaveContext } from "./map-save-context";

describe("MapSaveContext", () => {
  it("returns a no-op restore callback when no Realm adapter is installed", async () => {
    const restore = await MapSaveContext.prepare();
    expect(() => restore()).not.toThrow();
  });

  it("prepares and restores a canonical map context", async () => {
    const restore = vi.fn();
    const prepare = vi.fn(() => restore);
    const unregister = MapSaveContext.register(prepare);

    const restorePrepared = await MapSaveContext.prepare();
    await restorePrepared();

    expect(prepare).toHaveBeenCalledOnce();
    expect(restore).toHaveBeenCalledOnce();
    unregister();
  });
});
