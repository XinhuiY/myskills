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
//    Use the Spring Icons library key — NOT the Spring DS key (icons aren't in that library).
//    search_design_system does semantic matching; if the result isn't the expected icon,
//    check DS_KEYS.md for a previously cached key, or look up the component directly in
//    the "Spring Icons (Sorted)" file.
const results = await search_design_system({
  query: name,                         // e.g. "HomeMd", "CaretDownMd"
  includeLibraryKeys: [SPRING_ICONS_LIBRARY_KEY],  // see Figma Library Keys section
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

Append newly discovered icon keys to `DS_KEYS.md` in the artifact root (next to `SCREENS.md`). If `DS_KEYS.md` doesn't exist yet, copy it from `templates/DS_KEYS.md`. This keeps accumulation project-local — no need to PR back to the skill repo.

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
| `bg-danger-t10` / `text-danger-t10` | `Danger/t10` | `908311bd66baf8740334f907efa825a0d2f46907` |
| `bg-danger-t20` / `text-danger-t20` | `Danger/t20` | `0d4574fb022d6fff66ebe7ab4a6970c4eac7a07c` |
| `text-danger-f` | `Danger/f (Rest)` | `97bed1633c9ba238ec36032820454aef3400deb2` |
| `bg-danger` / `text-danger` | `Danger/DEFAULT (Rest)` | `3d58a87325d43b4d79b71a1ea409d8678f659909` |
| `bg-success-t10` / `text-success-t10` | `Success/t10` | `1ecc7929cd49572a0e65a13e5ffb8b13faf3c3d4` |
| `bg-success-t20` / `text-success-t20` | `Success/t20` | `f12eec0faaca550dbcf68c9517e25209d3b5eea7` |
| `text-success-f` | `Success/f (Rest)` | `32548a353e53cb988f00cd389f760c00b1a79fdd` |
| `bg-success` / `text-success` | `Success/DEFAULT (Rest)` | `374778322f298ea27a7fb830449bb84e774b909e` |

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
| `<Switch>` | Switch | `04e2c8e24b3a4d0b5e212ff381af70ea03915a88` |
| `<Avatar>` (no presence indicator) | Avatar | `5c8d5c5d47115f7857cb77a61871036561a3f4dd` |
| `<Avatar>` (with presence indicator) | Avatar With Presence | `7931e27d6b28d7bed3ace256cf7f0f792d72e076` |
| `<Tag>` | Tag | `09c27e1530c0e2ccffdf848ae7a117fb57839204` |
| `<Chip>` | Chip | `9f54cfe0d4aa80e2fa129e229468564f071fc981` |
| `<Badge>` | Badge | `6eebc614a66ef765f683068a7151a0c003b6c8b4` |
| `<Tabs>` | Tabs | `09cfedc2332a7e522e1686d20075033d08c4f8f2` |
| `<Tab>` (standard variant) | Tab - Standard | `ea8b8184e80704805de54ceeaca1b0c52b795aa2` |
| `<Tab>` (pill variant) | Tab - Pill | `5af12995abfea37460bc193db12f6cc05436433b` |
| `<Tooltip>` | Tooltip | `c3431dce19551d340d2bebef90815d362fa74eac` |
| `<Dialog>` | Dialog | `3f20ea64c7682ff3dee705b727e5e11f9c5f49ee` |
| `<Snackbar>` | Snackbar | `f67940dc7f8fd1246fa41b839677d844398f2398` |
| `<Stepper>` | Stepper | `0c7a6b69591baabb970816bf42af05abb0a4a59d` |
| `<Step>` (inside Stepper) | Stepper/Step | `60ca16dbe80783cc212839d8243887965efa49bc` |
| `<MenuItem>` | MenuItem | *(key not yet confirmed — run Step 1 lookup and add to DS_KEYS.md)* |
| `<Menu>` | Menu | *(PENDING — MCP transport dropped both attempts; run Step 1 lookup and add to DS_KEYS.md)* |

For any component not in this table (Drawer, Radio, Select, etc.), inspect `componentPropertyDefinitions` (see "Process: when a variant cannot be found" → Step 1) and record the key in `DS_KEYS.md`.

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

#### `<Switch>`
```js
instance.setProperties({
  "Size": "Medium",          // inspect componentPropertyDefinitions for full size range
  "State": "Default",        // Default | Hover | Disabled
  // Checked/unchecked is a separate variant property — inspect componentPropertyDefinitions
  // for the exact key name (commonly "Checked" or "Selected") and add to DS_KEYS.md
});
```

#### `<Avatar>` / `<Avatar>` with presence
```js
// No-presence variant (key: 5c8d5c5d47115f7857cb77a61871036561a3f4dd):
instance.setProperties({
  "Size": "XXLarge",         // XSmall | Small | Medium | Large | XLarge | XXLarge
  "Variant": "Circle",       // Circle | Square (inspect for full set)
  // Text/image slot keys (initials label, image source) require componentPropertyDefinitions
});

// With-presence variant (key: 7931e27d6b28d7bed3ace256cf7f0f792d72e076):
instance.setProperties({
  "Size": "XXLarge",
  "Variant": "Circle",
  // Presence/Status slot key requires componentPropertyDefinitions
});
```

> **Choosing between the two Avatar sets:** use the presence variant only when the JSX renders a presence/status indicator alongside the avatar. For a plain avatar, always use the no-presence set.

#### `<Tag>`
```js
instance.setProperties({
  "Color": "Default",        // Default | Primary | Success | Warning | Danger — inspect for full set
  "Variant": "Filled",       // Filled | Outlined
  // Label text key requires componentPropertyDefinitions (e.g. "Label#xxx:0")
  // Icon slot key (if applicable) also requires componentPropertyDefinitions
});
```

#### `<Chip>`
```js
instance.setProperties({
  "Color": "Default",        // Default | Primary — inspect for full set
  "Size": "Large",           // Small | Medium | Large
  // "Truncate" boolean and label text key require componentPropertyDefinitions
});
```

#### `<Badge>`
```js
instance.setProperties({
  "Variant": "Contained",    // Contained | Outlined
  "Color": "Primary",        // Primary | Secondary | Danger | Success — inspect for full set
  "Size": "Small",           // Small | Medium | Large
  // Count/label text key requires componentPropertyDefinitions
});
```

#### `<Tabs>` / `<Tab>`
```js
// Tabs wrapper (key: 09cfedc2332a7e522e1686d20075033d08c4f8f2):
instance.setProperties({
  "Variant": "Standard",     // Standard | Pill
});

// Individual Tab — Standard (key: ea8b8184e80704805de54ceeaca1b0c52b795aa2):
instance.setProperties({
  "State": "Default",        // Default | Hover | Active | Disabled — inspect for full set
  // Label text and icon slot keys require componentPropertyDefinitions
});

// Individual Tab — Pill (key: 5af12995abfea37460bc193db12f6cc05436433b):
instance.setProperties({
  "State": "Default",
});
```

#### `<Tooltip>`
```js
instance.setProperties({
  // All property keys (placement, label text) require componentPropertyDefinitions —
  // Tooltip Code Connect returned no props. Run:
  //   const set = await figma.importComponentSetByKeyAsync("c3431dce19551d340d2bebef90815d362fa74eac");
  //   return set.componentPropertyDefinitions;
  // then add the full block to DS_KEYS.md.
});
```

#### `<Dialog>`
```js
instance.setProperties({
  "Size": "Large",           // Small | Medium | Large | XLarge
  // Slot keys for title, content, and action areas require componentPropertyDefinitions.
  // Dialog children (DialogTitle, DialogContent, DialogActions) are separate auto-layout
  // frames to create and parent, not instance properties.
});
```

#### `<Snackbar>`
```js
instance.setProperties({
  // All property keys require componentPropertyDefinitions — Snackbar Code Connect
  // returned no props. Run:
  //   const set = await figma.importComponentSetByKeyAsync("f67940dc7f8fd1246fa41b839677d844398f2398");
  //   return set.componentPropertyDefinitions;
  // Common expected props: Severity (Info | Warning | Error | Success), message text key.
  // Add the full block to DS_KEYS.md after lookup.
});
```

#### `<Stepper>` / `<Step>`
```js
// Stepper wrapper (key: 0c7a6b69591baabb970816bf42af05abb0a4a59d):
instance.setProperties({
  // fixedStepWidth in React likely maps to a boolean or Layout variant in Figma.
  // Inspect componentPropertyDefinitions to confirm key name, then add to DS_KEYS.md.
});

// Individual Step (key: 60ca16dbe80783cc212839d8243887965efa49bc):
instance.setProperties({
  "State": "Default",        // Default | Active | Completed | Error — inspect for full set
  // Label/description text keys require componentPropertyDefinitions
});
```

#### `<MenuItem>`
```js
instance.setProperties({
  // Component set key not yet confirmed. Run search_design_system for "MenuItem" scoped
  // to the Spring DS library key, then inspect componentPropertyDefinitions. Record in DS_KEYS.md.
  // Expected props: label text key, icon slot key, State (Default | Hover | Disabled).
});
```

---

## Figma Library Keys

Three libraries are attached to the Spring Design System file. Pass the appropriate key(s) to `search_design_system` as `includeLibraryKeys: [...]` to scope searches.

| Library | Use for | Key |
|---|---|---|
| Spring Design System | Components, color variables, text styles | `lk-32e6af93b330295d762db67dc330a085798333c302035e0b05e0ce1a530493a3d7b845d8ce58cd9269cfbb3291e68380a4c1272c089d56f88d4108fe9c054708` |
| Spring Icons (Sorted) | Icon component lookup by name | `lk-192fdb33f4bc6e44adb1f1a91ff157d0be75811c95f73cbc42998bafabb97844b0a662f3afc73a0b020ce1a37408de16ed11ce678b3b978c65b8267f8b277cd6` |
| Spring RingEX Components | App-level composite patterns (AI Hub, App Bar, etc.) | `lk-df84671d797640afea517e3c9aa92aa3bd369822a8599b2427fc85edc9ddc0c5fd7d1b9c3888c2d2ac49c3c825822c56d7a069b4783c62e5d3a75dc020a6ddba` |

> **Icon searches must use the Spring Icons library key**, not the Spring DS key. The Spring DS library does not contain the icon component set — icon searches scoped to it will return zero or unrelated results.

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
