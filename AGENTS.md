Azgaar's Fantasy Map Generator is a web application for procedurally generating, editing, and visualizing fantasy maps. Before making architectural decisions, read the `CONTEXT.md` file in the root.

## Native integration requirement

Extend existing native entity models, Tools, editors, overviews, renderers and persistence instead of building parallel simplified systems. A settlement must be a real Burg, not a marker labelled as a city; a route must work with native Routes tools. Layers controls are for display, not replacement CRUD editors. Verify creation, editing, relocation, deletion, relationships and save/load through the native UI. Ask the user before deciding ambiguous domain semantics or introducing a separate mechanism. Moving a duplicate panel to Tools is not integration.

For deeper knowledge, consult the `docs/` directory, especially `docs/domain/glossary.md`, `docs/architecture/architecture.md` and `docs/architecture/data-model.md`.

Keep comments short and to the point. Don't repeat information that is in docs. Prefer one-liners or no comments.
