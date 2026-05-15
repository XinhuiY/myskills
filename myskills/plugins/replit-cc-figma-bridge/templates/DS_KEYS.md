# <Artifact name> — Design System Keys

Project-local cache of Figma keys and Spring component property names
discovered during export. Lives next to `SCREENS.md` in the artifact root.
Agents append here as they go — this file is never sent back to the skill repo.

See `modules/export-to-figma.md` for keys already documented at the skill
level: text styles, color variables, and `setProperties()` names for Button,
IconButton, TextField, Link, Alert, and Divider. Only record things not already
there.

---

## Icon keys — `figma.importComponentByKeyAsync(key)`

Discovered from `data-icon` attributes during export (see "Icons — the
`data-icon` bridge" in `modules/export-to-figma.md`).

| `data-icon` (Spring component name) | Figma component key |
|---|---|

---

## Component property names — `instance.setProperties({})`

For Spring UI components not yet documented in `modules/export-to-figma.md`.
To discover a component's property names, inspect its `componentPropertyDefinitions`:

```js
const set = await figma.importComponentSetByKeyAsync("<key>");
return {
  variants: set.children.map(c => c.name).slice(0, 20),
  props: set.componentPropertyDefinitions,
};
```

Then paste the result below in the canonical `setProperties()` format. Include
the component set key so the next export can skip the `search_design_system` call.

### Example entry

```js
// <ComponentName> — component set key: <key>
instance.setProperties({
  "PropertyName#id:id": "DefaultValue",  // allowed values: A | B | C
});
```

---

## Additional color / text style keys

For variables or text styles discovered beyond the tables in
`modules/export-to-figma.md`.

| Tailwind class / description | Spring DS name | Key |
|---|---|---|
