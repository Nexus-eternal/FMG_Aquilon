# Underwater domain foundation

Underwater is a domain over Surface water, not a parallel Realm. The first slice
provides state, persistence, a cell-based editor and an SVG domain layer.

## Ownership

`RealmData.underwater` owns a domain registry. `.map` record 53 carries its optional
`domains.underwater` state alongside RealmData v2. Existing maps without domains
start empty. Entity-only Realm saves and switching Sky/Surface leave the domain
alone. Reset/new map clears it. No terrain, grid, climate or separate ocean is stored.

Each entity has a domain-local numeric ID, kind, name, nonnegative finite depth in
metres, and a footprint of canonical Surface **grid** cell IDs. IDs share one
namespace within Underwater but can coincide with Surface/Sky IDs. Point entities
(settlements and markers) have one cell; zones and factions have a footprint;
routes have an ordered corridor of at least two adjacent water cells. Depth zero
is valid. Optional faction membership references an existing faction in this domain.
This DTO is not a complete native Burg/State schema or a replacement generator.

## Placement and terrain edits

Mutations require explicit Surface geography. Callers must pass Surface heights,
never the temporarily active Sky terrain. All referenced cells must satisfy `h < 20`.
Route validation checks every corridor cell and adjacency, not only endpoints.
The corridor is not yet an arbitrary freehand polyline; future route/editor adapters
must validate the cells crossed by their actual geometry.

Invalid updates leave existing data unchanged. Invalid restored structure is
rejected before replacing live registry state. Restore validates structure and
references before geometry is available; placement is checked against current
Surface by `audit` and `getVisible`. If a terrain edit turns water into land, the
entity remains stored but is excluded from the visible result. `audit` reports why.
Returning the cell to water makes the object eligible again. Nothing is silently
deleted or moved to another cell.

## Depth filtering

The filter is an inclusive minimum/maximum range. Disabling it shows all valid
placements regardless of depth. Range filtering does not mutate entities. Getters
return copies, so external code cannot bypass validation by mutating a read result.
Unknown fields are omitted when entities enter the registry; domain state cannot
smuggle in an extra terrain snapshot.

## Verification

The full test run passed: 119 files, 1271 tests. Production build and TypeScript
passed. Tests cover water/land threshold, zero/invalid depths, invalid cell IDs,
point footprints, complete route corridors, adjacency, copy isolation, faction
references/removal protection, non-destructive filters and terrain-edit quarantine,
JSON round-trip, old maps, reset and RealmData integration.

## Editor

Layers → Underwater — depth editor is available in both normal and Realm demo
builds. Choose a kind, name and depth, then Add on map. Points snap to the clicked
Surface water cell. Routes use two endpoints and the existing FMG pathfinder to
find a water-only corridor. Zones and factions collect clicked water cells; Finish
area commits them, Cancel/Escape abandons only the draft. Pick an entity in the
list or click its shape to edit name/depth/faction, redraw its footprint or delete it.
Removal of a faction with members is blocked until members are reassigned.

The domain uses the existing layer group for visibility, opacity, locking and
order. Show Underwater layer also clears the demo's cloud veil for legibility.
Editing is disabled in Sky; switching back restores Surface objects. Surface
backdrop snapshots exclude the Underwater layer so it cannot leak into Sky.

The SVG renderer sends route segments through shared Voronoi-edge midpoints,
keeping each segment inside the validated water cells instead of cutting corners
through neighbouring land. Point settlements are domain annotations, not native
Burg economy/population simulation. Factions are domain memberships and painted
footprints, not native State diplomacy. Bathymetry and depth profiles remain future
features; every entity currently has one scalar depth.

Browser checks cover land rejection, city creation/edit/move, a water route, painted
faction/zone, membership, filtering without data loss, Sky isolation, and save from
Sky followed by browser-storage .map load. Four objects, depths and membership
were restored. A full downloaded-file round-trip is not claimed here.
The final browser pass also placed a depth-zero marker and edited the city's depth
after loading. Placement uses a document-level capture listener because loading
replaces the SVG map element; a regression test covers this replacement.
