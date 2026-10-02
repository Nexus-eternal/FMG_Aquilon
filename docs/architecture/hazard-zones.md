# Native hazard zones

## Scope

Hazard rules extend the existing Zone model, Tools → Zones editor, Paint Zones,
native polygon renderer and `.map` save/load. They do not introduce a new entity
panel in Layers. A rule selects Surface, Sky / Air and/or Underwater, severity,
an advisory restricted-passage flag, required equipment and movement multiplier.
Optional altitude and depth bounds are metres, inclusive. Blank means unbounded.
Routes remain editable and traversable: no automatic damage, pathfinding penalty,
inventory verification, portals, gateways or teleportation is implemented.

## Shared footprint and native integration

Legacy zones keep their existing Realm-local packed-cell geometry. Applying rules
promotes that same Zone object to a shared world zone. `worldCells` is its canonical
footprint on the base Grid; packed `cells` is an explicit derived projection for
native table statistics and painting in the active Realm. Conversion may slightly
change the outline near coasts because the base Grid has a different resolution.

`RealmData.worldZones` owns the shared objects, with IDs from 2000000 upward to
avoid collisions with generated Realm-local zones. Realm snapshots exclude these
objects; serialized shared objects omit derived packed cells. Switching Realm or
loading a map reprojects against `pack.cells.g`. A paint operation modifies only
affected base cells, retaining canonical coverage not present in the current pack.
Rendering calls the existing `getVertexPath` with the base Grid rather than using
a separate polygon algorithm. Notes, names, type, colour and visibility remain
fields on the native Zone. Native deletion, CSV export, legend and regeneration
work with the same objects; regeneration preserves shared zones and locked zones.

The Zones editor lists shared zones even when their scope does not display in the
current Realm, allowing scope edits without switching worlds. Table population,
area and cell counts describe the active pack projection, not a cross-Realm total.
Native paint filters and land-only controls remain available.

## Advisory route intersections

The existing Route Creator and Route Editor show an amber warning for intersecting
enabled hazards. Hidden zones still warn: display visibility is not gameplay scope.
Air routes use Sky rules in either Realm; ordinary routes in Sky use Sky rules;
Underwater routes use underwater rules. Underground tunnels are outside this stage.
Known altitude/depth outside the configured range suppresses a warning. Unknown
altitude/depth does not silently suppress a bounded hazard.

Intersection is sampled at no more than a quarter of the Grid spacing (with a
0.5-map-unit lower limit). Shared zones use base-grid lookup; legacy footprints use
native packed-cell lookup. Air sampling follows the quadratic rendered arc. Other
routes currently sample their point-to-point segments, not every native Catmull-Rom
curve excursion. Therefore these are advisory cell-resolution warnings, not exact
polygon collision detection or a navigation guarantee. Equipment and movement are
reported, not enforced or applied to route travel time.

## Verification, 2026-10-02

- Full test suite and production build pass; focused tests cover domains, bounds,
  hidden/disabled warnings, air arcs, cross-pack mapping, incremental painting,
  canonical serialization, deletion and backward-compatible state versions.
- Manual browser QA applied rules in the native Zones editor, switched to Sky,
  edited a real native route, observed its warning and retained normal editing.
- Saved through the native browser-storage workflow, loaded again, switched to
  Sky and recovered both the route name and its hazard warning.
- Hid the hazard and confirmed the warning remained. Re-enabled display and
  changed its footprint with the native Paint Zones brush and Apply action.
- Created and deleted an empty shared test zone with the native buttons, then
  switched Realm and confirmed it did not return. Native zone regeneration
  preserved the configured high and critical hazards.
- UI QA caught hidden checkboxes (missing native CSS class), a numeric step
  rejecting 0.5, and a stale Realm switch label after load. All were repaired;
  form regression tests cover checkbox styling, multiplier validity and atomic
  rejection of an invalid environment selection.
- Final checks: 125 test files, 1292 passing tests, scoped Biome check,
  TypeScript and production build. No automated Playwright E2E suite was run.

Merge remains pending user acceptance. No Google Drive TODO item is marked complete
by this implementation commit; the former Gateways wording must not be treated as
permission to implement portals.
