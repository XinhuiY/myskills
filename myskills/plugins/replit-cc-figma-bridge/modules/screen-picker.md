# Screen Picker

Runtime FAB-driven screen picker for Spring UI demo apps. Two operations: **install** the scaffold, and **add a screen**.

This module ships theme + screen switching only (no environment frames, no role picker). If a project later needs macOS/Windows simulators or role switching, layer those in separately — keep this module focused.

## Mental model

A **screen** is `{ flow, step }`:

- **Flow** — a top-level grouping (e.g. `Sign in`, `Home`, `Settings`). Renders as a `MenuHeader` inside the FAB's Export submenu.
- **Step** — a leaf within the flow (e.g. `Email`, `Password`, `Verify`, `Success`). Renders as a `MenuItem` under that flow's header.
- **Screen ID** — the canonical string `"<Flow>/<Step>"` (e.g. `"Sign in/Email"`). This is what the host component branches on and what `screen` state holds.

Adding a screen is a one-row append to a registry. If the flow doesn't exist yet, it's auto-created — there is no separate "register a flow" step.

## FAB layout — Theme + Export are the canonical last two items

Every FAB built from this template has the same fixed shape at the bottom:

```
┌────────────────────────┐
│  …project items…       │   ← freely customizable area (env switches,
│                        │     role pickers, links, layout pickers, etc.)
├────────────────────────┤   ← MenuDivider (required)
│  Theme               ▸ │   ← canonical Theme item (required, 2nd-to-last)
├────────────────────────┤   ← MenuDivider (required)
│  Export              ▸ │   ← canonical Export item (required, always last)
└────────────────────────┘
```

- **Theme + Export** are the two required, fixed items the skill ships. They are **always** the last two items in this exact order: `Theme` is the 2nd-to-last item and `Export` is the last. Each is preceded by its own `MenuDivider`. Nothing may be inserted between them or below `Export`.
- Clicking **Theme** opens a **2nd-level menu** anchored to the Theme `MenuItem`, listing every Spring-supported theme. Selecting one writes to `setThemeOption(<value>)` and closes both menus.
- Clicking **Export** opens a **2nd-level menu** anchored to the Export `MenuItem`, listing every screen in `SCREENS` grouped by `flow` (`MenuHeader` per flow, `MenuItem` per step). Selecting a screen calls `setScreen("<Flow>/<Step>")` and closes both menus.
- **Anything above** the Theme divider is the project's choice — env switches, role pickers, layout pickers, links to docs, etc.

This shape is what `templates/PresentationConfigFab.tsx` implements — when editing the FAB inside an installed project, preserve the Export-at-bottom-with-divider structure even if everything above it changes.

### Share affordance

Each step in the 2nd-level Export submenu has a hover-revealed **share** icon. Clicking it copies a paste-ready "optimal export prompt" (Flow / Step + a pointer to `SCREENS.md` + asset upload reminder) to the clipboard, designed to be pasted into Claude Code (or any agent that loads this skill) so it can render that exact screen and export it to Figma. Always on — no adapter wiring required. If `modules/snapshots.md` is also enabled, every snapshot row gets the same affordance, with state-delta detail when the adapter implements `describePromptDelta`.

### Copy link affordance

Each step also has a hover-revealed **copy link** icon (chain link). Clicking it copies the current page URL with `?screen=<id>` swapped to that step (and the current `?theme=` preserved if non-default) to the clipboard. The result is a shareable deep link: pasting it into a browser, Figma comment, or Slack message opens the published Replit demo at exactly that screen and theme — no instructions needed.

Copy link appears on **steps only**, not on snapshots. Snapshots carry complex adapter state (`TState`) that can't be fully encoded in a URL.

This affordance only works correctly when `PresentationConfigContext` is URL-backed (see "URL-backed state" below). Without that, the URL doesn't encode screen/theme and the copied link just opens the default screen.

### Inline icon-button style (rename / share / copy link / delete)

The hover-revealed affordances inside the Export submenu (rename pencil on flows / steps / snapshots, share on steps / snapshots, copy link on steps, delete on snapshots) all share one canonical style, factored into the `iconButton(label, icon, onClick, variant, extraMargin)` helper inside `templates/PresentationConfigFab.tsx`:

- **Size / shape:** `h-5 w-5`, `rounded-[6px]`, icon glyph `h-3 w-3`.
- **Idle color:** `text-[#72757a]`, fully transparent (`opacity-0`).
- **Reveal:** Tailwind `group-hover:opacity-100` / `group-focus-within:opacity-100` — the parent row (`MenuHeader` or `MenuItem`) must carry `className="group"`.
- **Hover variants:**
  - `header` — used inside `MenuHeader` (flow header). Hover bg `#eef0f3`, text `#323439`.
  - `row` — used inside `MenuItem`. Hover bg `white`, text `#323439`.
  - `danger` — used for snapshot delete. Hover bg `white`, text `#d70015`.
- **Icons:** `Pencil`, `Share2`, `Link`, `Trash2` from `lucide-react`. This is an intentional exception to the "no `lucide-react` substitution" rule in `implement-from-figma.md` / `build-in-replit.md` — those rules govern Figma-translated screen content, not FAB tool chrome.

When customizing the FAB inside an installed project, route any new affordance through `iconButton` (or copy its class string verbatim) so every row stays visually consistent.

## Architecture

```
src/
  screens.ts                          # SCREENS registry + ScreenId type + helpers
  presentation-config/
    PresentationConfigContext.tsx     # theme + screen state + provider + hook
    PresentationConfigFab.tsx         # FAB + Flow/Step menu + Theme menu
    snapshots.ts                      # types/store imported unconditionally by the FAB;
                                      # stays inert until the snapshots add-on is wired up
    index.ts                          # barrel
SCREENS.md                            # screen-name → source-location table
```

The host component (typically `Home()` in `src/App.tsx`) reads `screen` from context and branches its return statement on the screen ID. Each branch is preceded by an anchor comment of the form:

```tsx
// SCREEN: <Flow> / <Step> (see SCREENS.md)
```

so the screen is grep-findable even if line numbers drift.

> **Spacing note.** The anchor comment is human-readable and uses **spaces around the slash** (`Sign in / Email`). The runtime **screen ID** is the same pair without the spaces (`"Sign in/Email"`). Both forms are canonical — don't try to normalize one into the other.

## Operation 1 — Install

Use when the artifact has no `src/presentation-config/` folder yet.

1. Pick the host component that owns the screen-bearing JSX (usually `Home` in `src/App.tsx`). Confirm with the user if ambiguous.
2. Copy these files from `../templates/`:
   - `screens.ts` → `<artifact>/src/screens.ts`
   - `PresentationConfigContext.tsx`, `PresentationConfigFab.tsx`, `snapshots.ts`, `index.ts` → `<artifact>/src/presentation-config/`

   `snapshots.ts` is required because the FAB imports its types unconditionally; it stays inert (zero behavior, nothing in localStorage) until you opt into the snapshots add-on by passing `screenStateAdapter`. Don't skip it.
3. Replace the placeholder `SCREENS` registry in `src/screens.ts` with the real screens that exist today, in display order:

   ```ts
   export const SCREENS = [
     { flow: "Sign in", step: "Email" },
     { flow: "Sign in", step: "Password" },
     { flow: "Sign in", step: "Verify" },
     { flow: "Sign in", step: "Success" },
   ] as const;
   ```

   Conventions:
   - **Flow** — Sentence case, human-readable (`Sign in`, not `signin`).
   - **Step** — Sentence case, human-readable, no flow prefix (`Email`, not `Sign in — Email`). The flow name already appears as the section header.
   - **Order** — flows appear in the FAB in the order their first entry appears in `SCREENS`. Steps within a flow appear in the order they're listed.
4. Refactor the host component:
   - Remove the local `step` (or equivalent) state.
   - `const { screen, setScreen } = usePresentationConfig()`.
   - Replace branching on `step` with branching on the screen ID: `if (screen === "Sign in/Password") { ... }`.
   - Update internal navigation handlers to call `setScreen("<Flow>/<Step>")` instead of the local setter.
   - Add a `// SCREEN: <Flow> / <Step> (see SCREENS.md)` comment immediately above each return branch — **including the final unconditional `return` for the default screen**, even though it has no `if` guard. `grep -n "// SCREEN:" src/App.tsx` should always return one match per screen.
5. Wrap the app in `BrowserRouter` (from `react-router-dom`) and `PresentationConfigProvider`, then render `<PresentationConfigFab />` once near the root, inside the existing `ThemeProvider` chain. `PresentationConfigProvider` uses `useSearchParams` internally and **must be inside a `BrowserRouter`**. The `ThemeProvider` must read `themeObject` from `usePresentationConfig()` so theme switching works — which means the `ThemeProvider` lives **inside** the `PresentationConfigProvider`. Canonical shape:

   ```tsx
   // src/App.tsx (or wherever the root tree lives)
   import { BrowserRouter } from "react-router-dom";
   import { ThemeProvider } from "@ringcentral/spring-ui";
   import {
     PresentationConfigProvider,
     PresentationConfigFab,
     usePresentationConfig,
   } from "./presentation-config";

   function ThemedApp() {
     const { themeObject } = usePresentationConfig();
     return (
       <ThemeProvider theme={themeObject}>
         <Home />
         <PresentationConfigFab />
       </ThemeProvider>
     );
   }

   export default function App() {
     return (
       <BrowserRouter>
         <PresentationConfigProvider>
           <ThemedApp />
         </PresentationConfigProvider>
       </BrowserRouter>
     );
   }
   ```

   The `ThemedApp` indirection exists solely so `usePresentationConfig()` can be called inside the provider. Don't try to inline it.

6. Copy `../templates/SCREENS.md` into the artifact root and fill in the rows for the existing screens.
7. **Populate the Static assets table.** Walk every screen branch and the shell, list every image / SVG / video referenced in the JSX (e.g. `<img src={\`${base}ringcentral-logo.png\`} />`), and add one row per asset to the Static assets table mapping the JSX reference to its local path under `public/`. This is what lets export prompts upload assets to Figma instead of substituting placeholders.
8. **Optional — FAB position.** The template positions the FAB bottom-right (`bottom: 24, right: 24`). If the brief calls for a different placement (e.g. top-right for a header-anchored demo), edit the inline `style` on the wrapping `<div>` in `PresentationConfigFab.tsx` — that's the only positioning code.

9. **Optional — customize the area above the Theme item.** Projects are free to add items (env switches, role picker, layout picker, links to docs, etc.) above the Theme `MenuDivider`. Do not insert items between Theme and Export, and do not add anything below Export — see the "FAB layout" section above. Theme and Export are the canonical last two items, in that order.
10. **Dependency check** — two packages are required beyond Spring UI:
    - `react-router-dom` — `PresentationConfigContext` uses `useSearchParams` for URL-backed state. Install if missing: `npm install react-router-dom`.
    - `lucide-react` — the FAB imports `Pencil`, `Share2`, `Link`, and `Trash2` for its hover-revealed affordances. Most Replit fullstack-js / shadcn artifacts already ship it; install if missing.
11. **Rename is on by default.** The FAB ships with `enableRename = true`, so the pencil-icon rename affordances appear on flows / steps / snapshots out of the box. They POST to `/api/screens/rename-flow` and `/api/screens/rename-step` — mount the server routes per `modules/rename-in-app.md` so the clicks actually rewrite source files. If you don't want the pencils (e.g. published demo, no server, or static-only artifact), pass `<PresentationConfigFab enableRename={false} />`.
12. Run the artifact's typecheck script and fix any errors before handing back.

## Operation 2 — Add a screen

Use when the FAB scaffold already exists and the user wants to register a new screen.

Inputs you must resolve before editing — **only two**:

- **Flow** (e.g. `Sign in`) — the top-level group. If the flow already exists in `SCREENS`, the new step joins that group. If it doesn't, a new `MenuHeader` is created automatically.
- **Step** (e.g. `Verify`) — the leaf name shown as a `MenuItem`.

The screen ID is derived as `"<Flow>/<Step>"`. You don't pick it separately.

Steps:

1. **Registry** — append one row to `SCREENS` in `src/screens.ts`, in the position you want it to appear in the menu:

   ```ts
   export const SCREENS = [
     { flow: "Sign in", step: "Email" },
     { flow: "Sign in", step: "Password" },
     { flow: "Sign in", step: "Verify" },
     { flow: "Sign in", step: "Success" },
     { flow: "Home", step: "Dashboard" }, // new flow auto-creates a new MenuHeader group
   ] as const;
   ```

   No edits to the FAB or context are needed — the FAB reads `SCREENS` directly and groups by flow.

2. **Host component** — add a new branch in the component that branches on `screen`. Place the anchor comment directly above it:

   ```tsx
   // SCREEN: Home / Dashboard (see SCREENS.md)
   if (screen === "Home/Dashboard") {
     return (
       <AppShell>
         {/* TODO: implement screen */}
       </AppShell>
     );
   }
   ```

   If the user provided real markup, use it. Otherwise leave a clearly-marked TODO so the next iteration is obvious.

   The default screen (the final unconditional `return`) also needs its `// SCREEN:` anchor — see the install rules above. If the new screen is being made the default, swap the anchor comments accordingly and update `SCREENS[0]` so `DEFAULT_SCREEN` resolves to it.

3. **SCREENS.md** — append a row to the Screens table. After the edit, recompute line ranges for every row whose JSX shifted (use `grep -n "// SCREEN:" src/App.tsx` plus the next `}` boundary) and rewrite all affected rows in the same edit so the table is accurate.

4. **Static assets** — if the new branch references any image / SVG / video that is not already in the Static assets table, add a row mapping the JSX reference to its local `public/` path. Verify the file actually exists at that path before adding the row.

5. **Typecheck** — run the artifact's typecheck script. The screen ID type is derived from `SCREENS` via a template literal: `\`${ScreenDef["flow"]}/${ScreenDef["step"]}\``. If you typo the ID in `setScreen("...")` or `screen === "..."`, TypeScript will catch it.

## URL-backed state

`PresentationConfigContext` stores `screen` and `themeOption` as URL search params via React Router's `useSearchParams` — not in `useState`. This means:

- **Deep links work.** Pasting `https://your-demo.replit.app/?screen=Sign+in%2FPassword&theme=junoLight` into a browser opens that exact screen and theme.
- **Reload-safe.** Refreshing the page restores the last-viewed screen and theme.
- **Default state = clean URL.** `DEFAULT_SCREEN` and `"light"` are never written to the URL — the base URL (`/`) opens the default screen in light theme with no params.

| URL param | Controls | Default (omitted) |
|---|---|---|
| `?screen=<Flow>%2F<Step>` | Active screen | `DEFAULT_SCREEN` (`SCREENS[0]`) |
| `?theme=<value>` | Active Spring theme | `"light"` |

**Prerequisite:** the app must be wrapped in `<BrowserRouter>` (see Operation 1, step 5). Without it, `useSearchParams` throws and the context won't mount. If the artifact already uses a different React Router setup (e.g. `createBrowserRouter`), use a compatible router — the context just needs to be inside any Router boundary.

**Not in the URL:** snapshot state (`TState` from the adapter) is localStorage-only and cannot be fully encoded in URL params. Copy link on steps copies `?screen=` + `?theme=`; snapshot state is intentionally excluded.

## Conventions

- **`SCREENS` in `screens.ts` is the single source of truth** for what appears in the FAB and what screen IDs are valid. Never hand-maintain a parallel union elsewhere.
- **Keep the FAB the single source of truth for the current screen.** Internal navigation (Next/Back buttons) must call `setScreen("<Flow>/<Step>")` so the FAB selection stays in sync.
- **Default screen** is `SCREENS[0]`. To change the default, reorder `SCREENS` rather than overriding `DEFAULT_SCREEN`.
- **Anchor comments are mandatory on every branch, including the default unconditional `return`.** `grep -n "// SCREEN:" src/App.tsx` is the canonical screen index.
- **Never delete a `SCREENS` row without also deleting the corresponding branch and `SCREENS.md` row.**
- **Step names must be unique within a flow.** `"Sign in/Email"` and `"Home/Email"` are fine; two `"Sign in/Email"` entries would collapse in the menu and produce duplicate IDs.

## Spring UI 1.9.2 + React 19 Menu typing

The `Menu`, `MenuHeader`, `MenuItem`, `MenuItemText`, and `MenuDivider` exports require `placeholder`, `onPointerEnterCapture`, and `onPointerLeaveCapture` because of stale `@types/react` constraints. The template `PresentationConfigFab.tsx` already works around this by re-aliasing each as `ComponentType<any>`. Keep that pattern when editing the template — do not remove the casts.

## Prompt template the user will rely on

Once installed, the user can ask any agent to act on a screen by name with no further context:

> Export "Sign in / Email" to Figma. See `<artifact>/SCREENS.md` for the source location.

`SCREENS.md` resolves the screen ID to a file, component, and line range. The Static assets table resolves any image references. Anchor comments make line drift recoverable.

## Templates

See the **Templates** section in `SKILL.md` for the canonical list (`screens.ts`, `PresentationConfigContext.tsx`, `PresentationConfigFab.tsx`, `snapshots.ts`, `server/*`, `index.ts`, `SCREENS.md`). The install steps above only require the first three plus `snapshots.ts` (which stays inert until the snapshots add-on is wired up) and `SCREENS.md`.

## Optional add-ons

- **Snapshots** — runtime state "variants" of code-defined screens. See `modules/snapshots.md`.
- **Rename in-app** — rename flows / steps from inside the running app via source-file rewrites. See `modules/rename-in-app.md`.

Both are off by default and don't affect projects that don't opt in.
