# Vertical coordinates: Sky slice

## Data contract

`altitude` and `depth` are optional finite nonnegative numbers in metres. They are
independent of the terrain heightmap's 0–100 relief values. Explicit zero is valid;
an absent altitude inherits the island altitude, with 1000 m as the fallback.
Burgs and markers inherit via their cell; routes use their first point's cell;
zones use their first cell. A route currently has one altitude, not a vertical profile.

RealmData v2 stores entity coordinates with existing scoped entities and island
coordinates in `featureCoordinates`. `verticalFilter` is optional and disabled by
default, so existing maps remain compatible. Saving entities preserves the filter.
Feature user-data capture preserves altitude and depth when feature IDs are rebuilt.
Route splitting copies coordinates; joining different coordinate assignments is rejected.

## Editing and visibility

In the generated Sky editor, expand **Sky altitude (metres)**. Choose an island,
burg, marker, route or zone. Input changes apply immediately; clearing the field
restores inheritance. Refresh objects after creating/removing entities in native editors.

The inclusive From/To range only affects visibility. It never deletes entities or
rebuilds geography. Terrain uses an SVG clip; entities use scoped CSS selectors.
Disable the filter to edit hidden objects. Surface and the cloud veil remain visible.
The render hook and viewbox observer reapply visibility after native redraws.
Surface scope clears the active filter before rendering or saving its canonical body.

This is a first Sky slice, not full 3D rendering: numeric altitude does not physically
raise islands on the globe. State/province labels and other non-altitude-aware layers
are not yet individually assigned an altitude. Underwater editing, depth filtering,
domain UI and cross-Realm route profiles remain separate work.

## Underwater foundation

`validateUnderwaterPlacement` checks depth and requires every referenced Surface
cell to be water (`h < 20`). Invalid indices and empty placements are rejected.
This is a pure data helper; it does not add an underwater geography or expose a
finished Underwater editor.

## Verification (2026-10-01)

- Full Vitest run: 116 files, 1245 tests passed.
- TypeScript and production build passed.
- Browser: changed Deseri Yur to 3200 m; enabled 0–2000 m filter. Its terrain and
  inherited entities disappeared; the clip retained 11 of the original 12 islands.
- Browser storage uses the same .map serialization/load path: saved, loaded, entered
  Sky, and confirmed 3200 m, enabled filter, maximum 2000 m and 11 clipped islands.
- UI testing caught and fixed a hidden checkbox caused by global styles, and changed
  altitude editing from blur/change to immediate input so native hotkeys do not
  prevent committing the field.
- The initial download-event check timed out; storage round-trip was used instead.
  An older local .map was also loaded during investigation, not mistaken for the
  new save. Direct downloaded-file round-trip has not been verified this session.
