---
name: spring-screen-bridge
description: Build, register, and export RingCentral Spring UI screens. Each screen stays addressable as a single Flow/Step across three surfaces — a FAB menu item at runtime, a branch in the host source component, and a Figma frame — kept in lockstep via a SCREENS.md mapping. Use for any task that builds a Spring UI screen, adds one to the in-app picker, or exports one to Figma.
---

# Spring Screen Bridge

This skill makes a **screen** the single addressable unit across three surfaces. A screen is identified by a `{ flow, step }` pair, and its canonical ID is the string `"<Flow>/<Step>"` (e.g. `"Sign in/Email"`).

| Surface     | What "a screen" looks like there                                  |
| ----------- | ------------------------------------------------------------------ |
| Runtime UI  | One `MenuItem` (the **Step**) under a `MenuHeader` (the **Flow**) in the FAB |
| Source code | One row in the `SCREENS` registry in `src/screens.ts`, plus one `if (screen === "<Flow>/<Step>")` branch in the host component, marked with a `// SCREEN: <Flow> / <Step>` anchor comment |
| Figma       | One frame, exportable from the source branch using Spring DS keys  |

`SCREENS.md` is the table that ties them together. Once installed, any agent can resolve a screen name to a precise source location, the assets it depends on, and the Figma keys it needs — without re-discovery.

Three modules support that bridge:

1. **Build** the screen using production-accurate Spring UI patterns.
2. **Register** the screen in the FAB and `SCREENS.md`.
3. **Export** the screen to Figma using the Spring DS library's persistent keys.

Read only the modules relevant to the current task. For copy-pasteable prompts the user can hand to any agent, see `USAGE.md` in this skill folder.

## When to use which module

| Task                                                                 | Module                          |
| -------------------------------------------------------------------- | ------------------------------- |
| Building a new Spring UI demo (sign-in, settings, marketing card…)   | `modules/build-in-replit.md`    |
| Adding the screen-picker FAB to a demo, or registering a new screen  | `modules/screen-picker.md`      |
| Exporting a `.tsx` source file to a Figma frame                      | `modules/export-to-figma.md`    |
| All of the above (typical: design a demo, ship it, export it)        | All three, in that order        |

## Typical workflow

```
build with prod-patterns        →   register screens with screen-picker  →   export with figma-keys
─────────────────────────────       ──────────────────────────────────       ──────────────────────
Spring class structure              Install FAB scaffold                     Read SCREENS.md to find the JSX
Color & typography tokens           Append { flow, step } to SCREENS         Look up text/color/component keys
Layout & data-test-automation-id    Branch host component on screen ID       Bind nodes to Spring DS library
Tailwind config                     Update SCREENS.md table + assets         Upload assets, set properties
```

## Modules

### `modules/build-in-replit.md`

How real RingCentral pages are implemented with Spring UI: theme & scope setup, the compiled `sui-<component>-<variant>` class structure, the full color and typography token catalogues, layout conventions (pixel-pinned widths, Tailwind-utility-heavy), `data-test-automation-id` conventions, and the required Tailwind config. Read this before writing any Spring UI JSX.

### `modules/screen-picker.md`

Runtime FAB picker that lets designers switch between named screens (and themes) at runtime, with a companion `SCREENS.md` table that maps `Flow / Step` to source file + component + line range. The `SCREENS` registry in `src/screens.ts` is the single source of truth — the FAB groups by `flow` automatically (new flows auto-create a new `MenuHeader` section). Two operations: **install** the scaffold, and **add a screen**. Templates in `templates/`.

### `modules/export-to-figma.md`

Persistent Spring DS Figma library keys for text styles, color variables, and component sets, plus the per-component `setProperties()` property names. Use to translate a `.tsx` file into Figma nodes bound to the real library. Includes the library key for scoping `search_design_system`.

## Templates

Used by the screen-picker install workflow:

- `templates/screens.ts` — `SCREENS` registry, derived `ScreenId` template-literal type, `groupScreensByFlow` helper, and `DEFAULT_SCREEN`.
- `templates/PresentationConfigContext.tsx` — slim provider with theme + screen state, `screen` typed as `ScreenId` from the registry.
- `templates/PresentationConfigFab.tsx` — FAB that auto-groups screens by flow into `MenuHeader` + `MenuItem` sections, plus a Theme menu (includes the React 19 type-cast workaround for Spring UI 1.9.2's Menu family).
- `templates/index.ts` — barrel export.
- `templates/SCREENS.md` — table template with Shell, Registry note, Screens (Flow / Step / ID columns), Static assets, prompt template, and a pointer to "Adding a new screen".

## Conventions enforced across modules

- **`SCREENS` in `src/screens.ts` is the single source of truth** for what screens exist and what IDs are valid. Adding a screen is a one-row append; the FAB and screen ID type derive from it. Never hand-maintain a parallel union elsewhere.
- **Anchor comments** on every screen branch: `// SCREEN: <Flow> / <Step> (see SCREENS.md)`, including the default unconditional `return`. Makes screens grep-findable when line numbers drift.
- **FAB is the single source of truth for the current screen.** Internal navigation also calls `setScreen("<Flow>/<Step>")` so the FAB selection stays in sync.
- **Static assets** referenced by screens are catalogued in the SCREENS.md Static assets table, mapping JSX reference → `public/` path. Figma export prompts upload assets via this table; never substitute placeholders.
- **Spring DS keys are stable** — never regenerate them at runtime; always import by the documented key.
