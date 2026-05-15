---
name: replit-cc-figma-bridge
description: Build, register, and export RingCentral Spring UI screens. Each screen stays addressable as a single Flow/Step across three surfaces — a FAB menu item at runtime, a branch in the host source component, and a Figma frame — kept in lockstep via a SCREENS.md mapping. Use for any task that builds a Spring UI screen, adds one to the in-app picker, or exports one to Figma.
---

# Replit ↔ Claude Code ↔ Figma Bridge

This skill makes a **screen** the single addressable unit across three surfaces. A screen is identified by a `{ flow, step }` pair, and its canonical ID is the string `"<Flow>/<Step>"` (e.g. `"Sign in/Email"`).

| Surface     | What "a screen" looks like there                                  |
| ----------- | ------------------------------------------------------------------ |
| Runtime UI  | One `MenuItem` (the **Step**) under a `MenuHeader` (the **Flow**) inside the FAB's Export submenu |
| Source code | One row in the `SCREENS` registry in `src/screens.ts`, plus one `if (screen === "<Flow>/<Step>")` branch in the host component, marked with a `// SCREEN: <Flow> / <Step>` anchor comment |
| Figma       | One frame, exportable from the source branch using Spring DS keys  |

The FAB itself follows a fixed shape: an **Export** item is always the last menu item (with a `MenuDivider` above it), and clicking it opens a 2nd-level menu listing every registered screen, grouped by flow. Anything above the Export divider is project-customizable; nothing goes below. See `modules/screen-picker.md` "FAB layout" for the diagram.

`SCREENS.md` is the table that ties them together. Once installed, any agent can resolve a screen name to a precise source location, the assets it depends on, and the Figma keys it needs — without re-discovery.

Four core modules support that bridge, plus two optional add-ons:

1. **Implement from Figma** — translate a Figma frame into faithful Spring UI JSX (skip if there's no Figma reference).
2. **Build** the screen using production-accurate Spring UI patterns.
3. **Register** the screen in the FAB and `SCREENS.md`.
4. **Export** the screen back to Figma using the Spring DS library's persistent keys.
5. **Snapshots** — wire an adapter whenever the host component owns replayable state (form fields, toggles, selections, nav order, etc.) so designers can capture and replay state variants. Part of the standard screen-picker install path; skip only for pure / stateless screens. localStorage-only, no backend.
6. **Rename in-app** *(optional)* — rename flows / steps from inside the running app via source-file rewrites. Small Express endpoint, **no authz — local dev tools only**.

Read only the modules relevant to the current task. For copy-pasteable prompts the user can hand to any agent, see `USAGE.md` in this skill folder.

## When to use which module

| Task                                                                 | Module                          |
| -------------------------------------------------------------------- | ------------------------------- |
| Translating a Figma frame into JSX (any time the source is a Figma node) | `modules/implement-from-figma.md` |
| Building a new Spring UI demo (sign-in, settings, marketing card…)   | `modules/build-in-replit.md`    |
| Adding the screen-picker FAB to a demo, or registering a new screen  | `modules/screen-picker.md`      |
| Exporting a `.tsx` source file to a Figma frame                      | `modules/export-to-figma.md`    |
| Extending or customizing the snapshot adapter (wired during screen-picker install) | `modules/snapshots.md` |
| Renaming a flow / step from inside the running app                   | `modules/rename-in-app.md`      |

## Typical workflow

There are two starting points. Pick the one that matches the brief.

### Path A — Source of truth is a Figma frame

```
implement-from-figma          →   build-in-replit            →   screen-picker            →   export-to-figma
──────────────────────────       ───────────────────────         ──────────────────────       ──────────────────────
Fetch design context + screenshot  Spring class structure          Install FAB scaffold          Read SCREENS.md to find JSX
Map data-name → Spring component   Color & typography tokens       Append { flow, step }         Look up text/color/component keys
Extract LEAF tokens (not parent)   Layout & data-test-automation   Branch host component         Bind nodes to Spring DS library
Confirm icon substitutions         Tailwind config                 Lift state + wire adapter     Upload assets, set properties
Verify static-asset MIME + size                                    Update SCREENS.md
Never invent content
```

### Path B — Source of truth is a written brief (no Figma yet)

```
build-in-replit               →   screen-picker            →   export-to-figma
───────────────────────           ──────────────────────       ──────────────────────
Pick layout from brief            Install FAB scaffold          Read SCREENS.md to find JSX
Spring class structure            Append { flow, step }         Look up text/color/component keys
Color & typography tokens         Branch host component         Bind nodes to Spring DS library
Layout & data-test-automation     Lift state + wire adapter     Upload assets, set properties
Tailwind config                   Update SCREENS.md
```

`implement-from-figma` is only consulted on Path A. The other three modules are common to both.

**Where each step runs:** `implement-from-figma`, `build-in-replit`, `screen-picker`, `snapshots`, and `rename-in-app` all run inside Replit. The `rename-in-app` endpoint rewrites source files in the user's working tree (no authz — local dev tools only). `export-to-figma` requires the Figma **plugin API**, which the Replit MCP does not expose — that step typically runs in **Claude Code** with the Figma Desktop MCP attached. See `modules/export-to-figma.md` "Prerequisite" for the full split.

## Modules

### `modules/implement-from-figma.md`

Methodology for translating a Figma frame into faithful Spring UI JSX. Six phases: (1) fetch design context + screenshot, (2) map every Figma `data-name` to its Spring component before writing JSX, (3) extract typography/color/spacing tokens at the LEAF `<p>`/`<span>` not the parent `<div>`, (4) ask before substituting any non-exact icon match, (5) verify static-asset MIME + dimensions, (6) never invent copy. Includes pre-flight checklist and an anti-pattern catalog of real regressions. Read this **before** `build-in-replit.md` whenever the source of truth is a Figma node. Skip when the brief is text-only.

### `modules/build-in-replit.md`

How real RingCentral pages are implemented with Spring UI: theme & scope setup, the compiled `sui-<component>-<variant>` class structure, the full color and typography token catalogues, layout conventions (pixel-pinned widths, Tailwind-utility-heavy), `data-test-automation-id` conventions, and the required Tailwind config. Read this before writing any Spring UI JSX.

### `modules/screen-picker.md`

Runtime FAB picker that lets designers switch between named screens (and themes) at runtime, with a companion `SCREENS.md` table that maps `Flow / Step` to source file + component + line range. The `SCREENS` registry in `src/screens.ts` is the single source of truth — the FAB groups by `flow` automatically (new flows auto-create a new `MenuHeader` section). Two operations: **install** the scaffold, and **add a screen**. Templates in `templates/`.

### `modules/export-to-figma.md`

Persistent Spring DS Figma library keys for text styles, color variables, and component sets, plus the per-component `setProperties()` property names. Use to translate a `.tsx` file into Figma nodes bound to the real library. Includes the library key for scoping `search_design_system`.

> **Prerequisite:** the snippets in this module call the Figma **plugin API** (`figma.importStyleByKeyAsync`, etc.). They run in **Claude Code** with a Figma plugin MCP attached — not in Replit, whose Figma MCP only reads context, takes screenshots, uploads assets, and manages Code Connect. The module's "Prerequisite" section spells this out and lists which steps can be done from Replit (asset upload, Code Connect mapping) vs which require Claude Code (frame construction).

### `modules/snapshots.md`

Capture the current UI state of a code-defined screen as a localStorage-only "variant" rendered as an indented child of its parent step in the Export submenu. Per-project state shape via a small `ScreenStateAdapter<TState>` contract; the FAB handles save / apply / delete / "selected indicator" derivation generically. Clicking the parent step while on its screen calls `adapter.reset()` so the parent feels like a restore point. Optional `describePromptDelta` on the adapter feeds the share button's snapshot prompt.

On by default whenever the host component owns replayable state (form fields, toggles, selections, ordering, etc.). The install procedure inspects for such state, lifts it to `ThemedApp`, and wires an adapter. Pass no `screenStateAdapter` only when the screens are pure / stateless.

### `modules/rename-in-app.md` (optional)

Pencil-icon affordances on flows / steps in the Export submenu. POSTs to `/api/screens/rename-flow` and `/rename-step`, which rewrite all four bridge surfaces (`screens.ts`, `App.tsx`, page `.tsx`, `SCREENS.md`) using a plan-then-commit strategy. Backend ships as `templates/server/` files. **No authz — local dev tools only.** When combined with `snapshots.md`, the endpoint returns a `{ remap }` map so the FAB can patch any snapshot whose `screenId` embedded the renamed flow/step.

**On by default** (`enableRename={true}`) — pencil affordances appear immediately once the server routes are mounted. Pass `<PresentationConfigFab enableRename={false} />` to hide them (e.g. a published demo where the rename endpoints aren't reachable). Creating / deleting screens is intentionally NOT in this module — both remain code edits via Operation 2 of `screen-picker.md`.

## Templates

Used by the screen-picker install workflow:

- `templates/screens.ts` — `SCREENS` registry, derived `ScreenId` template-literal type, `groupScreensByFlow` helper, and `DEFAULT_SCREEN`.
- `templates/PresentationConfigContext.tsx` — slim provider with theme + screen state, `screen` typed as `ScreenId` from the registry.
- `templates/PresentationConfigFab.tsx` — FAB that auto-groups screens by flow into `MenuHeader` + `MenuItem` sections, plus a Theme menu (includes the React 19 type-cast workaround for Spring UI 1.9.2's Menu family). Optional `screenStateAdapter` and `enableRename` props light up the snapshots / renames add-on.
- `templates/snapshots.ts` — generic `Snapshot<TState>` store + `ScreenStateAdapter<TState>` contract used by the snapshots add-on.
- `templates/server/screensEdit.ts` — source-file rewriter that powers in-app flow / step renames (plan-then-commit, replacement-count assertions). Path-configurable.
- `templates/server/registerScreenRenameRoutes.ts` — Express helper that mounts `POST /api/screens/rename-flow` and `/rename-step`.
- `templates/index.ts` — barrel export.
- `templates/SCREENS.md` — table template with Shell, Registry note, Screens (Flow / Step / ID columns), Static assets, prompt template, and a pointer to "Adding a new screen".
- `templates/DS_KEYS.md` — project-local cache seeded on first export. Three tables: icon keys (`data-icon` → Figma component key), undocumented component `setProperties()` property names, and additional color / text style keys. Lives next to `SCREENS.md` in the artifact root; never sent back to the skill repo.

## Conventions enforced across modules

- **`SCREENS` in `src/screens.ts` is the single source of truth** for what screens exist and what IDs are valid. Adding a screen is a one-row append; the FAB and screen ID type derive from it. Never hand-maintain a parallel union elsewhere.
- **Anchor comments** on every screen branch: `// SCREEN: <Flow> / <Step> (see SCREENS.md)`, including the default unconditional `return`. Makes screens grep-findable when line numbers drift.
- **FAB is the single source of truth for the current screen.** Internal navigation also calls `setScreen("<Flow>/<Step>")` so the FAB selection stays in sync.
- **Static assets** referenced by screens are catalogued in the SCREENS.md Static assets table, mapping JSX reference → `public/` path. Figma export prompts upload assets via this table; never substitute placeholders.
- **Spring DS keys are stable** — never regenerate them at runtime; always import by the documented key.
