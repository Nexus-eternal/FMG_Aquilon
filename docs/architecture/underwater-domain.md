# Underwater domain foundation

Underwater is a domain over Surface water, not a parallel Realm. The first slice
is state and persistence only. There is no Underwater editor or renderer yet.

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

The full test run passed: 117 files, 1266 tests. Production build and TypeScript
passed. Tests cover water/land threshold, zero/invalid depths, invalid cell IDs,
point footprints, complete route corridors, adjacency, copy isolation, faction
references/removal protection, non-destructive filters and terrain-edit quarantine,
JSON round-trip, old maps, reset and RealmData integration.

There were no UI changes to accept in this slice. Next: Surface-aware adapters,
native editor integration where its land assumptions permit, domain renderer and
depth controls, then browser save/load and user acceptance before merging.
