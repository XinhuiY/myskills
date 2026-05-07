# Implement faithfully from a Figma frame

Use when the source of truth for a screen is a Figma node (typically pulled via `mcpFigma_getDesignContext`). This module is the **methodology** for translating that dump into Spring UI JSX without inventing content or guessing tokens.

For the *what to write* (Spring class structure, full token catalogues, Tailwind config), defer to `build-in-replit.md`. This module is the *how to read Figma so you write the right thing*.

If the user's brief is text-only ("build a sign-in page that…") with no Figma reference, you don't need this module — go straight to `build-in-replit.md`.

## Theme handling (Figma color mode ↔ Spring theme)

Before phase 1, identify the Figma frame's **color mode** (visible in the Figma UI; also surfaced in the `getDesignContext` response and any screenshot tooling). Map it to the Spring theme and set the FAB's default accordingly — do not leave it on the scaffold's default if Figma is in a different mode.

`@ringcentral/spring-theme` exports exactly four themes. There is **no** `suiJunoDark`; never invent or alias one.

| Figma color mode | FAB option (`ThemeOption`) | Spring export    |
| ---------------- | -------------------------- | ---------------- |
| Light            | `light`                    | `suiLight`       |
| Dark             | `dark`                     | `suiDark`        |
| High Contrast    | `highContrast`             | `suiHighContrast`|
| Juno Light       | `junoLight`                | `suiJunoLight`   |
| Juno Dark        | (unsupported)              | — surface to user; do not alias to `suiDark` |

Setting the default in the scaffold:

1. In `src/presentation-config/PresentationConfigContext.tsx`, change the initial `useState<ThemeOption>(...)` to the option matching Figma. The template ships `"light"`; bump it to `"junoLight"` (or whichever matches) per artifact.
2. The FAB template already lists all four options. If a project's older copy is missing `Juno Light`, sync it from `templates/PresentationConfigFab.tsx` — do not silently drop options.
3. If the Figma frame's mode is Juno Dark, stop and tell the user: "Spring doesn't ship a `suiJunoDark` theme. Options: (a) use `suiDark` and accept slight token drift, (b) ship without juno-dark, (c) wait for Spring to publish one." Do not pick for them.

This rule lives in repo memory (`replit.md` "Theme handling" section). Keep both in sync when the Spring theme catalogue changes.

## The six phases (do not reorder)

### Phase 1 — Fetch & inspect, never paraphrase

1. **One MCP call gets everything.** `mcpFigma_getDesignContext({ nodeId, fileKey, clientFrameworks: "react", clientLanguages: "typescript" })` returns three things in one response:
   - A `code` string (the React/Tailwind dump) — save to `.local/refs/<screen>.tsx.txt`
   - A `screenshot` of the node — save to `.local/refs/<screen>.png`
   - A JSON map of **asset download URLs** for every image referenced in the code. These URLs are temporary; download each one immediately and save under `<artifact>/public/` (or wherever the artifact serves static assets), then update the JSX `<img src>` to point at the local path.

   You only need a separate `mcpFigma_getScreenshot` call if you also want a higher-resolution render of a child node — the default screenshot from `getDesignContext` is enough for layout verification.
2. **Open code + screenshot side by side.** The dump tells you tokens; the screenshot tells you what is actually visible (truncations, wrap points, presence dots, hover-only chrome, things hidden behind menus). Believing one without the other is how you ship a screen that "matches the dump" but doesn't match the design.
3. Treat all visible text in the dump as authoritative — but treat all icons as candidates for substitution (see phase 4) and all images as something you must download + verify (see phase 5).

### Phase 2 — Component map (Figma `data-name` → Spring component) BEFORE writing JSX

For every node with `data-name="…"` (Button, Icon Button, Tag, Tooltip, Avatar, Menu, TextField, Checkbox, Switch, Tabs, Stepper, Dialog, Drawer, Snackbar, Alert, Badge, Divider, Empty State, Page Header, etc.), map it to a Spring component. The full inventory with prop signatures and variant unions lives in the project's memory file (e.g. `replit.md` "Spring component inventory" section); if it doesn't exist, build it once from `node_modules/@ringcentral/spring-ui/dist/components/` and `.agents/skills/spring-ui-react/references/components/`.

**Rule:** never roll your own with `<button>`/`<input>`/`<a>`/`<div role="…">` if a Spring component exists. If a Figma node looks interactive but `data-name` says "Frame" or "Container", still ask: "is this an interactive surface?" — if yes, Spring component.

Common silent regressions this catches:

- Text-only links/buttons → `Button variant="text" color="primary|neutral"`, not `<div>` or `<a>`.
- Header dropdowns ("Label ▾") → `Button variant="text" endIcon={CaretDownMd}`, not raw `<button>`.
- Card overflow "⋯" → `IconButton variant="icon" size="small"`, not bare SVG.
- Presence dots → wrap `Avatar` and absolute-position the dot; don't replace Avatar with a hand-rolled circle.
- "Active"/status pills → `Tag`, not styled `<span>`.

### Phase 3 — Token extraction at the LEAF, not the container

This is the single most common failure. The Figma dump nests like this:

```
<div data-name="App Bar">
  <div data-name="Side Nav">
    <div data-name="Nav Item">
      <p className="… text-[length:var(--typography/descriptormini/fontsize,12px)]
                       font-[var(--typography/descriptormini/fontweight,500)] …">
        <some label>
      </p>
    </div>
  </div>
</div>
```

The container divs carry **layout** (`flex`, `gap`, `bg`, `border`). The font/color/size tokens live **on the deepest `<p>`/`<span>`**. Reading only the container makes you default to whatever felt right.

**Mandatory grep before implementing each text element:**

```bash
rg -B1 -A2 '<text label>' .local/refs/<screen>.tsx.txt | rg 'typography/[a-z]+/fontsize'
```

If that returns nothing, the text isn't a leaf in this dump — keep digging into the surrounding JSX until you find the `<p>`/`<span>` that owns the typography variables.

#### Token translation (Figma var → Spring class)

Only the Figma-side translation column appears here. For Spring px / weight / line-height per class, see `build-in-replit.md` §4 (typography) and §3 (color).

Typography:

| Figma `--typography/<name>/…`   | Spring class                          |
| ------------------------------- | ------------------------------------- |
| `headline`                      | `typography-headline`                 |
| `display1` / `display2` / `display3` | same name, camelCased            |
| `title`                         | `typography-title`                    |
| `subtitle` / `subtitlebold` / `subtitlemini` / `subtitleminisemibold` | same, camelCased |
| `maintext`                      | `typography-mainText`                 |
| `label` / `labelsemibold`       | `typography-label` / `typography-labelSemiBold` |
| `descriptor` / `descriptormini` / `descriptorminisemibold` | same, camelCased   |
| `detail`                        | `typography-detail`                   |

Each Spring typography class **encodes its own font-weight**. Do not stack `font-bold`/`font-semibold` on top.

Color: Figma's `--sui-colors-<palette>-<shade>` → Spring's `<utility>-<palette>-<shade>` (e.g. `--sui-colors-neutral-b1` → `text-neutral-b1`, `bg-neutral-b1`, or `border-neutral-b1`). Alpha variants (`-t10`/`-t20`/`-t50`/`-t80`) preserve the same suffix.

**Never invent `text-sui-*`/`bg-sui-*`/`border-sui-*`** — the Tailwind plugin doesn't emit them; they're silent no-ops. The Figma dump uses `--sui-colors-…` as raw CSS-var fallbacks, which is misleading.

Spacing/radius: Figma `--spacing/<n>` (4 = 4px, 1.5 = 6px, 2 = 8px, 3 = 12px, 4 = 16px, 5 = 20px, 6 = 24px) → Tailwind arbitrary values (`gap-[12px]`, `p-[16px]`). Figma `--rounded-sm` (10px), `--rounded-md` (16px) → `rounded-[10px]` / `rounded-[16px]`. `999px` → `rounded-full`. Prefer pixel-pinned values from Figma over fluid Tailwind defaults.

### Phase 4 — Icons: ask before substituting

Use the `spring-icons` skill (`.agents/skills/spring-icons/SKILL.md`) — read it once per project. The setup rules (per-file imports, ambient `.d.ts`, sizes, color via `currentColor`) live in `build-in-replit.md` §8 and the skill; this phase covers the **decision** to make per Figma icon.

**Why it matters for the bridge:** every icon you place must go through the project's `iconMap` so it carries `data-icon="<SpringComponentName>"` on the rendered `<svg>`. That attribute is the *only* link back to a Figma component instance during export — hand-rolled `<svg>` or `<img src="figma/icon-foo.svg">` flatten on export and break the round-trip. Same rule when you pass an icon to `Button.startIcon` / `IconButton.symbol` — the Spring component spreads props, so the attribute lands on the SVG either way.

**Decision tree for each Figma icon:**

1. Find the Figma asset name (`imgVector*`, parent `data-name="ic_*"`, or the `data-name` of the wrapping frame — Figma often spells the intent there: `data-name="CaretDown"` → look for `CaretDownMd`).
2. Search `node_modules/@ringcentral/spring-icon/` for an obvious match. Try synonyms (Spring uses domain language: "phone" doesn't exist but `CallMd` does; "users" maps to both `TeamMd` and `UsersMd`).
3. **Exact match exists** → add an entry to `src/lib/iconMap.tsx` with `{ component, name }` and use the wrapper. Log nothing.
4. **Near-match exists** (e.g. Figma "Inventory" → Spring `ContainerMd`) → **ASK THE USER** with 2–3 closest candidates before substituting. Log the chosen mapping as a comment next to the map entry and in the screen registry so the next task doesn't re-litigate it.
5. **Bespoke colored badge / illustration** (e.g. a 40×40 colored circle with a glyph baked into one SVG, like brand category tiles) — these are not monochrome glyphs and Spring icons don't fit. **ASK THE USER** whether to keep as a decorative `<img>` or reconstruct as `<div bg-color><Icon className="text-white"/></div>`.
6. **No Spring icon exists** (e.g. horizontal ellipsis) → create a custom SVG under `src/components/icons/`, render it with `data-icon="custom:<Name>"`, register in the icon map. Custom icons export as flattened SVG in Figma — flag them in the export report.

Never silently fall back to `lucide-react`, `react-icons`, an inline SVG, or a "close enough" Spring icon. The icon system is a round-trip contract — substitutions must be explicit and recorded.

### Phase 5 — Static assets: verify file extension, MIME, and dimensions

For every `<img>` you write (downloaded in phase 1 from the asset URLs in `getDesignContext`):

1. `file <path>` to confirm the **bytes** match the **extension**. Figma sometimes serves SVG bytes from a `.png` URL — the browser refuses to decode and renders blank with no error. If `file` says SVG, rename the file and update the JSX `src`.
2. Set **both** `width` and `height` from Figma's parent frame. Setting only one dimension lets the asset's intrinsic ratio override and distort the design.
3. `curl -sI http://localhost:80<asset path through artifact base>` — confirm 200 + correct `Content-Type` after the workflow restart. (Always go through the proxy at port 80, not the artifact's internal port.)

### Phase 6 — Faithful content: never invent

Things you must NOT invent:

- Greetings ("Welcome back, …")
- KPI numbers / chart data
- Plan tier badges / status pills not present in Figma
- "Active" / "Online" indicators not present in Figma
- Card descriptions / body copy
- Any text not literally present in the Figma dump

If a card is empty in Figma (just header + "..."), build it empty. Plausible filler is the worst kind of regression because it looks finished and ships.

If the user explicitly says "fill in realistic copy" — fine, but call out which strings are fabricated.

## Pre-flight checklist (run before saying "done")

From the artifact directory:

```bash
# 1. TypeScript clean
pnpm exec tsc -p tsconfig.json --noEmit

# 2. No invented sui-* classes
rg "(text|bg|border)-sui-" src/

# 3. No raw interactive elements where Spring exists
rg "<button|<input |<select |<textarea |<a href" src/components/

# 4. Every interactive element has data-test-automation-id
rg "<(Button|IconButton|TextField|Tag|Avatar|Menu|Link)" src/components/ \
  | rg -v "data-test-automation-id"

# 5. Static assets resolve
curl -sI <each-asset-url>

# 6. Restart workflow and screenshot the result
restart_workflow "<workflow name>"
screenshot type=app_preview artifact_dir_name=<slug> path=/
```

If any check fails, fix before claiming done.

## Anti-pattern catalog

| Mistake | Symptom | What to do instead |
| --- | --- | --- |
| Wrong typography token | Read container divs, applied a default like `typography-mainText` to every label | Grep leaf `<p>` for `--typography/<name>/fontsize`, apply matching `typography-<name>` class |
| Invented Tailwind class | Wrote `text-sui-neutral-b1` (silent no-op) | Use Spring tokens: `text-neutral-b1`. Authoritative list in `build-in-replit.md` §3 |
| Raw `<button>` for a Spring control | Hand-rolled chrome that won't match focus/hover/disabled states | `<Button variant="text" color="…" endIcon={…}>…</Button>` |
| Raw `<div>` for a text-link button | No keyboard focus, no hover ring, no `data-test-automation-id` propagation | `<Button variant="text" color="primary" startIcon={…}>…</Button>` |
| Wrong variant union | `<IconButton variant="text">` (doesn't exist) | `'outlined' \| 'contained' \| 'icon' \| 'inverted'` |
| Wrong size union | `<TextField size="small">` (doesn't exist) | `'xlarge' \| 'large' \| 'medium'` |
| File extension mismatch | `*.png` containing SVG bytes → browser refuses to decode | `file <path>` to verify; rename to correct extension; update `<img src>` |
| Image only one dimension | Asset distorted to its intrinsic ratio | Set both `width` and `height` from Figma's parent frame |
| Invented copy | Added greetings, KPI tiles, plan badges not in Figma | Build only what Figma shows; leave empty regions empty |
| Silent icon substitution | Picked a similar-but-different Spring icon without confirming | Ask the user; log the substitution in project memory + screen registry |
| `font-bold` on top of typography class | Double-bold rendering | Spring typography classes include their own font-weight |
| Forgot workflow restart | User sees stale build when verifying | `restart_workflow "<name>"` after meaningful changes |
| Skipped screenshot | Said "done" without rendering | Always screenshot the running preview before claiming done |

## When to ask the user instead of guessing

- Icon ambiguity (no obvious Spring match)
- Empty regions in Figma — fill or leave empty?
- Color/state not visible in the static frame (hover, focus, disabled)
- Responsive breakpoints (Figma usually shows one)
- Whether to use real data or mock-empty for unimplemented data sources

## Update this module

When you discover a new failure mode (a new component variant union, a new typography token, a new file-format gotcha), add it to the anti-pattern catalog and the pre-flight checklist. The module is mutable — that's the point.
