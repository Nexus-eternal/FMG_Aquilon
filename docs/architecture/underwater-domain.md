# Underwater native integration

Underwater uses Surface water cells, not a separate terrain or parallel Realm.
The former annotation editor and SVG renderer were removed: cities are native
Burgs, factions are native States, and routes, markers and zones use their existing
models, Tools, overviews, editors and .map serialization.

## Workflow

Choose Tools → Add → Environment: Underwater and a depth in metres. Existing
Burg, Route and Marker buttons create underwater objects. States Editor → Add
creates a native state with a native capital. Zones Editor → Add creates a zone
at the chosen depth; its existing paint editor accepts water and rejects land.
Layers contains only non-destructive depth visibility controls, not entity CRUD.

Native Burg, Marker and Route editors include Environment and Depth fields.
Zones expose depth in their existing table; a blank depth means Surface.
Explicit zero is underwater, not missing data. Values must be finite and nonnegative.
Changing a water city to Surface is rejected until it satisfies the native land
placement rule. Relocation keeps one Burg per packed cell, at all depths.

## Ownership and government

An underwater Burg can belong to an ordinary state or a dedicated underwater
state. Its native state property is authoritative even when the water cell is
neutral; the Burg editor exposes the native ownership choice. Capitals retain
the native restrictions on reassignment and removal. Population statistics use
native Burg ownership, not an assumed land cell owner.

State.environment and environmentSubtype describe the state's habitat.
They are independent of its existing government form: an underwater monarchy,
republic or theocracy still uses the normal forms and diplomacy. State name/form
editing exposes the habitat and free-text subtype. Dedicated states can paint
water territory through the native state paint editor. New underwater states
start locked, following the existing protection mechanism for manual states.
Unlocking and regenerating a state intentionally permits its replacement.

## Geometry and visibility

Placement and edits require packed water cells (h < 20). Underwater routes use
linear control-point geometry and test intermediate points at spacing no greater
than a quarter grid interval (with a 0.5-unit floor). This is sampled validation,
not exact polygon intersection. Add control points around shores in the existing
route editor. Native split/join operations preserve compatible vertical coordinates.

The inclusive depth filter affects native icons, Burg/route labels, emblems,
markers, routes and zones without removing data. Data with invalid footprints
after terrain edits remains recoverable. Underwater editing is disabled while
Sky is active. Sky backdrop snapshots remove native deep-sea objects rather than
baking them into the surface seen from above.

Regenerating Surface Burgs, routes, markers or zones preserves manually created
underwater counterparts. Replacing unlocked states remaps surviving underwater
city ownership to a retained state or Neutrals, never an unrelated recycled ID.
There is no bathymetry, depth profile, automatic underwater economy generator or
multiple stacked cities per cell in this implementation.

## Legacy saves

The old registry remains a compatibility reader and depth-filter store in .map
record 53. On load, its annotations are converted to native models: settlement →
Burg, faction → State, route → Route, marker → Marker, zone → Zone. A faction
without a settlement needs a native capital and receives one in its footprint.
Grid footprints are mapped to Surface packed cells. A successful conversion clears
the old entity list, so reopening does not create duplicates.

Conversion is all-or-nothing. Invalid geometry or a one-city-per-cell collision
rolls back native data and retains the complete original registry. The UI reports
the reason; it does not silently move a city or discard the original save data.
Original annotation-only faction relationships on non-city objects are not a new
native political ownership model. Keep the original .map as a backup.

## Verification

Unit tests cover one-city occupancy, water placement, zero/invalid depth, route
segments crossing land, non-destructive filters, native state population ownership,
depth editing, successful legacy migration, repeat-load idempotence and rollback.
Browser checks include native creation, city properties and state reassignment,
native route editing, state creation/government/subtype, water-zone painting and
browser-storage .map save/load. Downloaded-file round-trip is not claimed.

The rejected annotation panel was the architectural mistake: moving it between
tabs would not fix surrogate cities, duplicate IDs or missing native editors.
The correction extends native models and their restrictions at the actual points
that previously assumed every city or state lived on land.
