# Spring Design System — Figma Keys Reference

This file documents the **persistent Figma keys** for the RingCentral Spring Design System Figma library. These keys are stable across projects and over time — they never change as long as the style/component exists in the library.

Use this file to skip the discovery phase when building Figma screens from Spring UI React source code.

## Prerequisite — where this module runs

The snippets below (`figma.importStyleByKeyAsync`, `figma.importComponentSetByKeyAsync`, `instance.setProperties`, etc.) are **Figma plugin API calls**. They require an MCP server that exposes a Figma plugin runtime — typically the `use_figma` tool family available in **Claude Code** with the official Figma Desktop MCP, or an equivalent plugin-API bridge.

**The Replit-side Figma MCP exposed in this workspace does NOT include a plugin runtime.** It can read design context, take screenshots, upload assets, create files, and manage Code Connect mappings (`mcpFigma_getDesignContext`, `mcpFigma_getScreenshot`, `mcpFigma_uploadAssets`, `mcpFigma_createNewFile`, `mcpFigma_addCodeConnectMap`, `mcpFigma_sendCodeConnectMappings`) — but it cannot execute the `figma.*` plugin calls that build the frame.

So the export workflow lives in two places:

| Step                                           | Tool                                            | Where it runs |
| ---------------------------------------------- | ----------------------------------------------- | ------------- |
| 1. Read source: open the `.tsx` and `SCREENS.md` | filesystem                                       | anywhere |
| 2. Upload static assets, get image hashes      | `mcpFigma_uploadAssets`                          | Replit or Claude Code |
| 3. Construct the Figma frame using the keys below | Figma plugin API (`figma.importStyleByKeyAsync` etc.) | Claude Code (plugin MCP required) |
| 4. (Optional) Bind the new frame back to source via Code Connect | `mcpFigma_addCodeConnectMap` + `sendCodeConnectMappings` | Replit or Claude Code |

If you're inside Replit and need to export, hand the prompt to Claude Code (with the Figma plugin MCP attached), or use Code Connect alone to associate an existing Figma component with the source file. Trying to run the snippets below from Replit will fail with "figma is not defined" or equivalent.

---

## How to use

### 1. Import a text style and bind it to a text node

Read the CSS class on the element in the source code, look up its key in the table below, then import and apply:

```js
// Example: element has className="typography-mainText"
const style = await figma.importStyleByKeyAsync("5a1b7a488d9a7d3f6c80c01d803f40c20a6ee0d2");
textNode.textStyleId = style.id;
```

### 2. Import a color variable and bind it to a fill

Read the Tailwind color class (`text-neutral-b0`, `bg-neutral-base`, etc.) and look up its key:

```js
// Example: element has className="bg-neutral-base"
const variable = await figma.variables.importVariableByKeyAsync("beec7eb49325e7fe737887486d0c433bdf9c9101");
const paint = figma.variables.setBoundVariableForPaint(
  { type: "SOLID", color: { r: 1, g: 1, b: 1 } },
  "color",
  variable
);
node.fills = [paint];
```

### 3. Import a component set and create an instance

Read the Spring UI component name from the JSX (`<Button>`, `<TextField>`, etc.) and look up its key:

```js
// Example: <Button variant="contained" color="primary" size="xlarge">Submit</Button>
const set = await figma.importComponentSetByKeyAsync("561ce036ff222a24f941b03da691d6878fe229a0");
const variant = set.defaultVariant; // defaultVariant is XLarge/Primary/Default
const instance = variant.createInstance();
instance.setProperties({ "Text#45:0": "Submit" });
```

### 4. Workflow for a full page

1. Read the source file (`.tsx`) to identify every element and its classes.
2. For each **text node**: look up the `typography-*` class → import text style → set `textStyleId`.
3. For each **background/fill**: look up the `bg-neutral-*` or `text-neutral-*` class → import variable → bind with `setBoundVariableForPaint`.
4. For each **Spring UI component**: look up the component set key → import → create instance → use `setProperties()` to override text/variants.
5. For each **icon** (every `[data-icon]` element on the rendered DOM — see Icons section below): resolve the Spring component key → import → create instance or fill the parent's `Icon#…:…` instance-swap slot.
6. The font family is always **Inter** — load with `figma.loadFontAsync({ family: "Inter", style: "..." })` before any text operations.

### 5. Icons — the `data-icon` bridge

Per the `spring-icons` skill and `implement-from-figma.md` Phase 4, every icon in the source app is rendered through a typed `iconMap` that stamps `data-icon="<SpringComponentName>"` onto the SVG. That attribute is the lookup key for export.

**For each `[data-icon]` you encounter, in render order:**

```js
// 1. Crawl: collect all icons + bounding boxes from the rendered DOM
const icons = Array.from(root.querySelectorAll("[data-icon]")).map(el => ({
  name: el.getAttribute("data-icon"),
  bbox: el.getBoundingClientRect(),
}));

// 2. For each Spring icon (data-icon does NOT start with "custom:"):
const results = await search_design_system({
  query: name,                         // e.g. "HomeMd", "CaretDownMd"
  includeLibraryKeys: [SPRING_LIBRARY_KEY],
  includeComponents: true,
});
const iconKey = results.components[0].key;
const iconComponent = await figma.importComponentByKeyAsync(iconKey);

// 3a. Standalone icon → create an instance, position from bbox
const instance = iconComponent.createInstance();
parent.appendChild(instance);

// 3b. Inside an IconButton / Button slot → use setProperties to fill the swap slot
buttonInstance.setProperties({ "Icon#360:0": iconComponent.id });
```

**Custom icons** (`data-icon` starts with `custom:`) have no Spring DS counterpart. Export as flattened SVG nodes and append to `variant-not-found.md` with a note: "Custom icon `custom:<Name>` exported as raw SVG — consider adding to design system."

**Why this works:** the `spring-icons` skill enforces that `data-icon` always equals the exact Spring component name. So React → DOM → Figma is lossless — no fuzzy matching, no per-export lookup table. Adding a new icon to the React app makes it round-trippable as long as it's registered in the icon map with the right `name`.

**Common icon keys** discovered during exports should be appended to a table here as you go (same pattern as the component set keys above), so future runs can skip `search_design_system`.

---

## Text Styles — `figma.importStyleByKeyAsync(key)`

Discovered by inspecting text nodes inside Spring DS component instances in Figma.
Source: `@ringcentral/spring-theme` → `themes/light.js` → `suiLight.content` CSS variables.

| Tailwind / CSS class | Figma style name | Key | Spec |
|---|---|---|---|
| `typography-descriptorMini` | `descriptorMini` | `ae2cda97e0147697b0ccf68a43c7c7323232f917` | 12px / Inter Medium / lh 17px |
| `typography-descriptor` | `descriptor` | `43e2d48cf9b25b7e327712092b17b23ca3e30103` | 12px / Inter Regular / lh 18px |
| `typography-mainText` | `mainText` | `5a1b7a488d9a7d3f6c80c01d803f40c20a6ee0d2` | 14px / Inter Regular / lh 20px |
| `typography-subtitleMini` | `subtitleMini` | `23af1e1212e3fff6730e6e9e640d54b5c1507db1` | 14px / Inter Medium / lh 20px |
| `typography-subtitle` | `subtitle` | `00bd626ca05906c9564e48b049b63f5118d4bc1b` | 15px / Inter Medium / lh 20px |
| `typography-subtitleBold` | `subtitleBold` | `06b65bcf49da1826053be0ae611c23418354efe5` | 15px / Inter Bold / lh 20px |
| `typography-display3` | `display3` | `31903d9967d4829be916ee7f8d4ea6f5662e008d` | 20px / Inter Semi Bold / lh 28px / ls -0.2px |
| `typography-title` | `title` | `d11117b62ea0a83e72c56cebde87e1cc1c1a0cfc` | 17px / Inter Medium / lh 25px / ls -0.2px |
| *(headline)* | `headline` | `e835894acf195b761060f8d96ac8a600f1db7db0` | 28px / Inter Bold / lh 36px |


### Link text styles (inside `<Link>` component instances)

These appear on text nodes within Spring DS Link instances. Use them when building custom link-like text nodes outside of the Link component.

| Figma style name | Key |
|---|---|
| `descriptorMini_link` | `7b49c8a7b9011f8656fd8c35feaee2f27e4b4338` |
| `descriptor_link` | `7ead170ea1951239e1bcc9a22a6091ed47e3498c` |
| `mainText_link` | `4bf3c16e8c6a08e48d02ef1608392bcfd4df1d23` |
| `subtitleMini_link` | `ad5ee4392e61f55f64e1fc711380cbee06fad4f3` |
| `subtitle_link` | `25fecfe02950b033f3bc5a68eb3a973f7aed8f9e` |
| `subtitleBold_link` | `17562d9601e542c12a138db77c4032f425037d36` |
| `title_link` | `23ab920771c9fd3aa976716a75227268c95b8a51` |

---

## Color Variables — `figma.variables.importVariableByKeyAsync(key)`

All from the Spring DS `Color` variable collection. Use `setBoundVariableForPaint` for fills and `setBoundVariable` for spacing/radii.

| Tailwind class | Spring DS name | Key |
|---|---|---|
| `bg-neutral-b5` | `Neutral/b5 (Hover)` | `02baf7f25be3adccb0f4fa0b544f52a5d94ce890` |
| `bg-neutral-base` | `Neutral/base` | `beec7eb49325e7fe737887486d0c433bdf9c9101` |
| `text-neutral-b0` | `Neutral/b0 (Text, Pressed)` | `b3f3e3da496d1e02d39ca26cf1593d6524ba170d` |
| `text-neutral-b1` | `Neutral/b1` | `71ee152eda04e3d49feae287f1b9caf4c8b33081` |
| `text-neutral-b2` | `Neutral/b2 (Secondary, Placeholder)` | `9bcb740622c36bfe1f570c344c27e1ebcba7b195` |
| `text-neutral-b3` | `Neutral/b3 (Pressed, Disabled)` | `5215987c14db41e89c19c533ec94fbc254086e8e` |
| `bg-neutral-b4` / `text-neutral-b4` | `Neutral/b4 (Container)` | `c872615433733590fe6087b5bb6a13a4409216c1` |
| `bg-primary-b` | `Primary/b (Rest, Focused)` | `44a2cb0c3edd68db0110952dd4eb71d5b5235687` |
| `text-primary-f` *(see pitfall below)* | `Neutral/static-w0` | `8e16e7540b43b5233f3a65a52465a013c60f2d1e` |

---

## Component Sets — `figma.importComponentSetByKeyAsync(key)`

| Spring UI JSX component | Figma component set name | Key |
|---|---|---|
| `<IconButton variant="icon">` | Desktop - Icon Button - Icon | `3520e35751379a50e23a9686dc9a5ff7564b716f` |
| `<Button variant="contained">` | Desktop - Button - Contained | `561ce036ff222a24f941b03da691d6878fe229a0` |
| `<Button variant="outlined">` | Desktop - Button - Outlined | `8eca1ccd326618eb0b1bcabf59bbef2755e4077c` |
| `<Button variant="text">` | Desktop - Button - Text | `fed45e14190e9402beb9fcb3e14faaef8dc3d2a2` |
| `<TextField>` | Text Field | `de3f9b0d97a3185c05ef5e782e4722c784cf0437` |
| `<Checkbox>` | Checkbox | `0d75c25c3fcda66c7ff8ec72a7ad93e0ab3d2351` |
| `<Link>` | Link | `cba8fe11ec4c98616ed32aa9d00c11d7216b52ca` |
| `<Alert>` | Alert | `2adb29720a880f65133125589e3ad283454b4611` |
| `<Divider />` | Divider | `505c08ba53ad79ddaeab27214030f83d43e48bee` |

### Component property names for `instance.setProperties({})`

#### `<IconButton variant="icon">`
```js
instance.setProperties({
  "Size":                    "Medium",     // XSmall | Small | Medium | Large | XLarge | XXLarge | XXXLarge
  "Color":                   "Secondary",  // Primary | Secondary | Success | Danger
                                           // Note: JSX color="neutral" → Figma "Secondary" (no Neutral variant)
  "State":                   "Default",    // Default | Hover | Disabled
  "Background?#9560:1934":   false,        // boolean — show/hide button background (false = transparent icon-only)
  "Icon#360:0":              "INSTANCE_SWAP_KEY", // swap to the icon component key (see variant-not-found.md)
});
```

> **Icon slot**: The `Icon#360:0` property is an INSTANCE_SWAP. To set a specific icon (e.g. ArrowLeftMd), find the icon's component key in Spring DS via `search_design_system` with the icon name and use `importComponentByKeyAsync`. Keys for common icons should be added to this file as they are discovered.

#### `<Button variant="contained">` / `<Button variant="outlined">` / `<Button variant="text">`
```js
instance.setProperties({
  "Text#45:0": "Button label",           // string
  "Size": "XLarge",                      // XSmall | Medium | Large | XLarge
  "Color": "Primary",                    // Primary | Secondary | Neutral | Danger
  "State": "Default",                    // Default | Hover | Pressed | Disabled | Loading
  "Start Slot#34:53": false,             // boolean — show leading icon slot
  "End Slot#27041:421": false,           // boolean — show trailing icon slot
});
```

#### `<TextField>`
```js
instance.setProperties({
  "↳ Label#44:43": "Email",             // string — field label
  "Placeholder#58:4": "you@company.com",// string — placeholder text
  "Value#58:6": "Entered text",         // string — current value
  "↳ Required#58:2": false,             // boolean — show required asterisk
  "Help Text?#58:16": false,            // boolean — show help text below
  "Clear Button?#518:37": false,        // boolean — show clear (×) button
  "Start Slot?#44:45": true,            // boolean — show leading icon
  "End Slot?#58:10": false,             // boolean — show trailing icon
  "Platform": "Desktop",               // Desktop | Mobile
  "Variant": "Outlined",               // Outlined | Contained
  "Size": "XLarge",                    // XLarge | Large | Medium
  "State": "Default",                  // Default | Focused | Disabled
  "Has Value": "False",                // True | False
  "Error": "False",                    // True | False
});
```

#### `<Link>`
```js
instance.setProperties({
  "Link#7022:35": "Learn more",         // string — link text
  "Color": "Primary",                   // Primary | Secondary | Inverted
  "Size": "13 mainText",               // "11 descriptorMini" | "12 descriptor" |
                                        // "13 mainText" | "13 subtitleMini" |
                                        // "14 subtitle" | "14 subtitleBold" | "17 title"
  "Underline": "Hover",                 // Hover | Always | None
  "State": "Default",                   // Default | Hover | Pressed | Disabled
});
```

**Mapping Spring UI `<Link>` typography classes → Size variant:**

| JSX className | Size value |
|---|---|
| `typography-descriptorMini` | `"11 descriptorMini"` |
| `typography-descriptor` | `"12 descriptor"` |
| `typography-mainText` | `"13 mainText"` |
| `typography-subtitleMini` | `"13 subtitleMini"` |
| `typography-subtitle` | `"14 subtitle"` |
| `typography-subtitleBold` | `"14 subtitleBold"` |
| `typography-title` | `"17 title"` |

#### `<Divider />`
```js
instance.setProperties({
  "Variant":     "Full",        // Full | Inset
  "Orientation": "Horizontal",  // Horizontal | Vertical — defaultVariant is Vertical/Full,
                                // so always set explicitly when used as an HR
});
// After parenting under an auto-layout frame:
instance.layoutSizingHorizontal = "FILL";
```

#### `<Alert>`
```js
instance.setProperties({
  "↳ Text#389:4": "Alert title",        // string — alert title text
  "↳ Description#389:6": "Details...",  // string — alert description
  "Title?#389:8": true,                 // boolean — show title
  "Description?#41914:0": true,         // boolean — show description
  "Actions?#389:18": false,             // boolean — show action buttons
  "Dismissible#390:0": false,           // boolean — show dismiss button
  "Platform": "Desktop",               // Desktop | Mobile
  "Severity": "Error",                  // Info | Warning | Error | Success
  "Compact": "False",                   // True | False
  "Action Position": "Bottom",         // Bottom | Right
});
```

---

## Figma Library Key

```
lk-32e6af93b330295d762db67dc330a085798333c302035e0b05e0ce1a530493a3d7b845d8ce58cd9269cfbb3291e68380a4c1272c089d56f88d4108fe9c054708
```

Pass this to `search_design_system` as `includeLibraryKeys: [...]` to scope searches to Spring DS only.

---

## Common pitfalls

Two export gotchas worth knowing before they cost you a re-run.

### `figma.createAutoLayout()` and `figma.createFrame()` return a white-filled frame

Both return a frame with a default opaque-white fill. When used as a transparent **layout wrapper** inside a parent that has a bound background variable (e.g. `bg-neutral-b5` on the page frame), the wrapper sits on top of the parent's color and silently masks it — the page renders white-on-white with no error and no warning.

Rule: if a wrapper does **not** correspond to a `bg-*` className in the JSX, clear its fill immediately after creation.

```js
const wrap = figma.createAutoLayout("VERTICAL", { name: "content-wrap" });
parent.appendChild(wrap);
wrap.fills = [];   // required for transparent wrappers
```

To catch a slip: after the skeleton step, take an inline `await frame.screenshot()` *before* any content is added. The bound bg color should already be visible. If it disappears in a later screenshot, the wrapper introduced in that step has a default fill.

### `text-primary-f` ≠ `Primary/f`

Spring UI's Tailwind class `text-primary-f` resolves to **white** — it's the "on-primary" foreground used for white text on a primary-blue surface (e.g. an avatar's initial letter). The Figma library has a variable named `Primary/f (Rest, Focused)`, which is **blue** — a primary-link text color used for blue text on a neutral surface (e.g. a hyperlink). The names match; the semantics don't.

Symptom: binding avatar text to `Primary/f` produces blue-on-blue invisible text.

Fix: for any Spring UI text using `text-primary-f`, bind to `Neutral/static-w0` (key `8e16e7540b43b5233f3a65a52465a013c60f2d1e`) — the always-white text variable the Tailwind class actually renders to. The companion `bg-primary-b` does map correctly to `Primary/b (Rest, Focused)` (key `44a2cb0c3edd68db0110952dd4eb71d5b5235687`); only the `/f` half of the pair is the trap.

---

## Process: when a variant cannot be found

**Never substitute a plain text node or hand-drawn primitive for a named Spring UI component.** If the right variant isn't immediately obvious from this file, follow these steps:

### Step 1 — Inspect the component set first

Before giving up, read the component's `componentPropertyDefinitions` in a `use_figma` call:

```js
const set = await figma.importComponentSetByKeyAsync("<key>");
return {
  variants: set.children.map(c => c.name).slice(0, 30),
  props: set.componentPropertyDefinitions,
};
```

Match the JSX props (`size`, `color`, `variant`, etc.) against the returned `variantOptions`. Most mismatches are solved here (e.g. `"etc."` entries in this file that weren't documented yet).

### Step 2 — Pick the closest variant and log it

If after inspection no exact match exists, pick the **closest** available variant and create (or append to) `variant-not-found.md` in the same directory as the screen's `SCREENS.md`. Never silently skip the component.

The file format is:

```md
# Variant Not Found

| Element | Source location | Wanted | Closest picked | Notes |
|---|---|---|---|---|
| `<Link className="typography-descriptor">Legal</Link>` | `src/App.tsx:48` | `Size="12 descriptor"` | `Size="11 descriptorMini"` | descriptor size not in lib at time of export |
```

Fields:
- **Element** — the full JSX tag with relevant props
- **Source location** — `file:line` from `SCREENS.md`
- **Wanted** — the exact property value you were looking for
- **Closest picked** — what you actually used
- **Notes** — why the exact match wasn't available (missing from lib, key not found, etc.)

### Step 3 — Update this file

After resolving a gap (either from inspection or from the design system team adding the variant), update the relevant property table above and remove the row from `variant-not-found.md`.

---

## How the keys were discovered

1. **Text style keys** — created a temporary Spring DS component instance in Figma via `use_figma`, walked all child `TEXT` nodes, read `node.textStyleId`, and called `figma.getStyleById(id).key`.
2. **Color variable keys** — used `search_design_system` with `includeVariables: true` scoped to the Spring DS library key.
3. **Component set keys** — used `search_design_system` with `includeComponents: true` scoped to the Spring DS library key.
4. **CSS spec values** — read from `node_modules/@ringcentral/spring-theme/themes/light.js` → `suiLight.content` (CSS custom properties string), parsed `--sui-typography-*` and `--sui-font-family` values.
