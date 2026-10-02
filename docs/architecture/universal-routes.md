# Native universal routes

Route.environment describes Surface, Air, Underwater or Underground independently
of its user-editable SVG style group. Old routes without this field retain their
Surface semantics; old depth-bearing routes remain Underwater. Tunnel depth does
not invoke underwater placement or visibility rules. No Underground Realm exists.

The native Route Creator, Route Editor and Routes Overview expose the environment.
Air routes can select real Surface and Sky Burgs as endpoints or use free map points.
Two selected cities can create a route without clicking artificial surrogate markers.
Endpoint identity is realm plus Burg id: identical Burg ids in different Realms
are distinct. Moving a city moves its endpoint. A deleted city leaves the geometry
recoverable and is explicitly shown as a missing endpoint for reassignment.

Air routes are native Route objects stored once in RealmDataState.airRoutes, in
version 3 of the existing .map extension record. Both active packs project the same
live objects; Realm snapshots exclude them. Save and realm switching capture edits
and deletions before restoring the next projection. World route ids are allocated
above the current ids of every saved Realm, starting at 1000000; no array-index
assumption or duplicated canonical city is introduced.

Air paths use gentle bounded quadratic arcs, group-controlled dashed strokes,
non-interactive light halos and terminal rings. They are cartographic symbols,
not physically lifted 3D globe geometry. Ground and Sky snapshot textures exclude
these shared routes to avoid ghost duplicates. Native labels, notes, groups, locks,
control-point editing, splitting, joining, deletion and overview searches remain
the entry points. Dragging an attached endpoint explicitly turns it into a free point.

Air links deliberately do not masquerade as land roads in the per-cell road graph.
Cross-Realm economics/pathfinding and automatic air/tunnel generation are not
implemented here. Height/depth is scalar per route, not a flight profile or bathymetry.
Underground routes are manually drawn paths with depth, not a separate terrain.
