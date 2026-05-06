# <Artifact name> Screens

Source-of-truth mapping from the FAB screen menu (Flow → Step) to the JSX that renders each screen. Use this when asking any agent to export, refactor, or redesign a specific screen by name.

## Registry

The single source of truth for what appears in the FAB is `src/screens.ts`. Each entry is `{ flow, step }`. The FAB groups by `flow` (preserving order of first appearance), renders the flow name as a `MenuHeader`, and the step name as a `MenuItem`. The screen ID is `"<Flow>/<Step>"`.

## Shell

If screens share a wrapper (logo, card, footer), document it here:

- File: `src/App.tsx`
- Component: `<ShellComponentName>`
- Lines: <start>–<end>

Otherwise delete this section.

## Screens

| Flow    | Step      | Screen ID         | File          | Component | JSX block (lines) |
| ------- | --------- | ----------------- | ------------- | --------- | ----------------- |
| App     | Screen A  | `App/Screen A`    | `src/App.tsx` | `Home`    | <start>–<end>     |
| App     | Screen B  | `App/Screen B`    | `src/App.tsx` | `Home`    | <start>–<end>     |

> Line ranges drift as code changes. Anchor comments (`// SCREEN: <Flow> / <Step> (see SCREENS.md)`) are placed directly above each branch so screens stay grep-findable: `grep -n "// SCREEN:" src/App.tsx`.

## Static assets

Images referenced in screens (logos, illustrations, etc.) live in `public/`. Resolve them before exporting:

| JSX reference            | Local path                                       |
| ------------------------ | ------------------------------------------------ |
| `<asset-filename>`       | `<artifact>/public/<asset-filename>`             |

When exporting to Figma, upload each asset with `upload_assets` and apply the returned `imageHash` — do **not** use a placeholder unless the file is genuinely missing.

## How to reference a screen in a prompt

> Export "App / Screen A" to Figma. See `<artifact>/SCREENS.md` for the source location.

## Adding a new screen

See `.agents/skills/spring-screen-bridge/modules/screen-picker.md` (Operation 2) for the canonical procedure. In short: append `{ flow, step }` to `SCREENS` in `src/screens.ts`, add a branch in the renderer with a `// SCREEN:` anchor comment, append a row to the table above. If the flow doesn't exist yet, just use a new flow name — the FAB auto-creates a new `MenuHeader` group for it.
