# Moved

This module was split into two single-topic modules. Use whichever one matches the task:

- **`modules/snapshots.md`** — runtime state "variants" of a code-defined screen, captured to `localStorage`. No backend.
- **`modules/rename-in-app.md`** — rename a flow / step from inside the running app via source-file rewrites. Small Express endpoint, **no authz — local dev tools only**.

Both add-ons are off by default. Either can be enabled without the other; both can be enabled together (the rename endpoint emits a `{ remap }` map that the FAB applies to local snapshot `screenId`s automatically).
