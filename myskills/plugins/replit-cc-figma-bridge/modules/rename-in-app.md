# Rename in-app (optional add-on)

Lets the user rename a flow or a step **from inside the running app**, with the rewrite happening in the source files. Pencil-icon affordances appear on hover next to flows and steps in the FAB Export submenu (and next to snapshots if `modules/snapshots.md` is also enabled — those are pure local renames).

Companion to `modules/snapshots.md`. Either feature can be enabled without the other.

| | Snapshots | Renames |
| --- | --- | --- |
| Persists to | `localStorage` | source files |
| Requires backend | no | yes — small Express endpoint |
| Security posture | safe (browser-only) | rewrites code; **local dev tools only** |

## How it works

A flow or step rename POSTs to `/api/screens/rename-flow` or `/api/screens/rename-step`. The endpoint rewrites four surfaces in lockstep:

- the row in `screens.ts`,
- the anchor comment in `App.tsx`,
- the anchor comment and any matching identifiers in the page `.tsx`,
- the row in `SCREENS.md`.

It uses a **plan-then-commit** strategy: every transform is computed in memory with replacement-count assertions, and nothing is written unless every check passes. After a successful rewrite, Vite hot-reloads the page; `localStorage` survives the reload, so any snapshot whose `screenId` embedded the renamed flow/step is patched in place using the `{ remap }` map the endpoint returns.

## Install

1. Copy the server template into your project's server folder (already done if you copied `templates/server/` during install):

   ```
   templates/server/screensEdit.ts                  → server/screensEdit.ts
   templates/server/registerScreenRenameRoutes.ts   → server/registerScreenRenameRoutes.ts
   ```

2. Mount the routes from your Express setup:

   ```ts
   // server/routes.ts (or wherever you register API routes)
   import { registerScreenRenameRoutes } from "./registerScreenRenameRoutes";

   export async function registerRoutes(app: Express) {
     registerScreenRenameRoutes(app);
     // ...your other routes
   }
   ```

   If your project layout differs from the bridge defaults (`client/src/screens.ts`, `client/src/App.tsx`, `client/src/pages`, `SCREENS.md`), pass custom paths:

   ```ts
   import path from "path";
   registerScreenRenameRoutes(app, {
     screensTs: path.join(process.cwd(), "src/screens.ts"),
     appTsx: path.join(process.cwd(), "src/App.tsx"),
     pagesDir: path.join(process.cwd(), "src/pages"),
     screensMd: path.join(process.cwd(), "SCREENS.md"),
   });
   ```

3. The pencil affordances are **on by default** (`enableRename = true`) — no FAB prop is needed once the server routes are mounted:

   ```tsx
   <PresentationConfigFab />
   // or, combined with snapshots:
   <PresentationConfigFab screenStateAdapter={adapter} />
   ```

   To hide the pencils (e.g. for a published demo where the rename endpoints aren't mounted), pass `enableRename={false}`:

   ```tsx
   <PresentationConfigFab enableRename={false} />
   ```

## Validation rules

Names must match `/^[A-Za-z0-9][A-Za-z0-9 _-]{0,49}$/` — alphanumeric plus spaces, hyphens, and underscores, 1–50 chars. The endpoint returns 400 on invalid names, 404 if the flow/step doesn't exist, 409 on collisions, and 500 if the source-file plan didn't match the expected number of replacements (which means the codebase has drifted from bridge conventions — fix the anchors before retrying).

## Security ⚠️

The rename endpoints rewrite source files with **no authz**. They are intended only for local single-user dev tools (e.g. a Replit preview where the user owns the repo). Do not mount them in any environment where someone other than the repo owner can hit them.

## Version control

Each rename produces uncommitted changes to four files in your working tree. Commit before the rename if you want a clean revert point, and review the diff before committing after — the rewriter is conservative (replacement-count assertions; refuses partial writes) but no automated rewrite is a substitute for a human read.

## What about creating / deleting screens?

Intentionally NOT in this module. Creating a screen requires generating a new page `.tsx` file plus inserting an `import` and `<Route>` into `App.tsx` — much higher risk of source-format drift than rename. Deleting is similarly destructive (orphaned imports, broken links). Both are kept as code edits via Operation 2 in `screen-picker.md`.
