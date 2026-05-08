# Snapshots (optional add-on)

A **snapshot** is a captured-state variant of a code-defined screen. It is NOT a new screen in the bridge sense (no `.tsx` file, no `SCREENS` row, no Figma frame); it's a user-saved overlay on top of an existing step. Snapshots render as inline indented children of their parent step in the FAB Export submenu and are addressed as `<Flow>/<Step>/<Snapshot name>`.

Mental model: **the parent step is the pristine code state. Each snapshot below it is a saved variant.** Clicking the parent step while already on its screen resets to defaults — the parent is its own restore point.

Persists to `localStorage` (this browser only). No backend required. For in-app rename of flows / steps (which does require a backend), see `modules/rename-in-app.md`.

## FAB props

Once installed, the FAB exposes a small surface of opt-in props. All are optional; the FAB renders a working Theme + Export menu with none of them set.

| Prop | Type | Effect |
| ---- | ---- | ------ |
| `screenStateAdapter` | `ScreenStateAdapter<TState>` | Enables snapshots (capture, apply, "selected" indicator on the matching step / variant). Without it, no snapshot affordances render. |
| `enableRename` | `boolean` (default `false`) | Enables pencil-icon rename affordances. See `modules/rename-in-app.md`. |
| `snapshotsStorageKey` | `string` (default `"fab-snapshots-v1"`) | Override the localStorage key — useful for namespacing per artifact. |

The adapter contract itself is similarly small:

| Field | Required | Effect |
| ----- | -------- | ------ |
| `capture` | yes | Returns the current `TState` to be saved. |
| `apply` | yes | Applies a saved `TState` back into the app. |
| `matches` | yes | Returns true when a saved state matches the live UI — drives the "selected" indicator. |
| `reset` | optional | Restores defaults. When provided, clicking the parent step on its current screen calls it; without it, that click is a no-op. |
| `describePromptDelta` | optional | Returns a multi-line description of how `TState` differs from defaults — drives the share button's snapshot prompt. See "Share prompts" below. |

Share buttons themselves are always on — they work on plain steps with no adapter at all. See `modules/screen-picker.md` "Share affordance" for the plain-step behavior.

## Install

1. Copy `templates/snapshots.ts` → `<artifact>/src/presentation-config/snapshots.ts` (already done if you copied the whole `templates/` directory during install).

2. Define what your app considers replayable state, then implement `ScreenStateAdapter<TState>`:

   ```tsx
   // src/presentation-config/screenStateAdapter.ts
   import type { ScreenStateAdapter } from "./snapshots";

   interface MyState {
     navOrder: string[];
     sidebarCollapsed: boolean;
   }

   export function useScreenStateAdapter(): ScreenStateAdapter<MyState> {
     const { navOrder, setNavOrder, sidebarCollapsed, setSidebarCollapsed,
             resetNav } = useMyAppContexts();
     return {
       capture: () => ({ navOrder, sidebarCollapsed }),
       apply: (s) => { setNavOrder(s.navOrder); setSidebarCollapsed(s.sidebarCollapsed); },
       matches: (s) =>
         s.sidebarCollapsed === sidebarCollapsed &&
         JSON.stringify(s.navOrder) === JSON.stringify(navOrder),
       reset: () => { resetNav(); setSidebarCollapsed(false); },
     };
   }
   ```

3. Pass the adapter into the FAB:

   ```tsx
   function ThemedApp() {
     const { themeObject } = usePresentationConfig();
     const screenStateAdapter = useScreenStateAdapter();
     return (
       <ThemeProvider theme={themeObject}>
         <Home />
         <PresentationConfigFab screenStateAdapter={screenStateAdapter} />
       </ThemeProvider>
     );
   }
   ```

That's it. Each step in the Export submenu now gets:
- A "+ Snapshot" item under the step you're currently viewing (it captures the live state into a new variant — a `window.prompt()` collects the name).
- Any saved snapshots render inline indented under their parent step. Clicking one calls `adapter.apply(state)` and navigates to its screen if needed.
- A `selected` indicator: a snapshot shows as selected when `adapter.matches(state)` returns true for it; the parent step shows as selected when you're on its screen and no snapshot matches. Pure state comparison, no bookkeeping.
- A **share** button (hover-revealed) on every snapshot, in addition to the share button already present on every plain step.

## Share prompts

The share button works on a plain step with zero adapter help (it just names the flow and step). For **snapshots** to produce a faithful prompt, implement `describePromptDelta` on your adapter — it returns a multi-line string describing only the bits of state that differ from defaults:

```ts
describePromptDelta: (s) => {
  const lines: string[] = [];
  if (s.sidebarCollapsed) lines.push("- Sidebar collapsed (icon-only rail).");
  if (s.selectedId !== "home")
    lines.push(`- Selected nav item: \`${s.selectedId}\`.`);
  if (JSON.stringify(s.navOrder) !== JSON.stringify(DEFAULT_ORDER))
    lines.push(`- Custom nav order: \`${JSON.stringify(s.navOrder)}\`.`);
  return lines.length ? lines.join("\n") : null;
}
```

Return `null` when the snapshot matches defaults so the prompt collapses to the plain-step form. The FAB never reads the state shape itself — anything inside `TState` is your project's business.

## Storage

Snapshots are written to `localStorage` under key `fab-snapshots-v1`. Override by passing `snapshotsStorageKey="..."` if you need to namespace per-artifact.

## Caveats

- Snapshots are device-local. They don't sync, version, or back up. They're a designer/dev productivity affordance, not a content store.
- The state shape is whatever `TState` you choose. Bump the storage key when you make a breaking change so stale snapshots are dropped instead of crashing your `apply()`.
- If you also enable `rename-in-app.md`, snapshot `screenId`s embed the renamed flow/step. The rename endpoint returns a `{ remap }` map and the FAB applies it to local snapshots automatically — no manual fixup needed.
