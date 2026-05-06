# RingCentral production Spring UI patterns

This module captures patterns observed in real production RingCentral HTML (the compiled `@ringcentral/spring-ui` v1.x output served by `app.ringcentral.com`). Use it whenever you build a RingCentral-branded surface in this monorepo — sign-in, marketing card, settings shell, modal, anything. It tells you how prod actually wires Spring components, tokens, and Tailwind utilities together so your demo doesn't drift into invented class names or off-brand styling.

It complements (does not replace) `.agents/skills/spring-ui-react/SKILL.md`, which covers the React API. This module covers what the **rendered page** looks like.

## How to read this guide

Sections 1–7 are **the rules** — token names, class structure, layout conventions, automation ID conventions, and Tailwind config. Follow them.

Section 8 is **one realistic syntax example** of those rules in use. It is *not* a layout to copy — it shows how the pieces fit together in a single file. The actual layout, content, and brand chrome of any page you build are decided by the user's brief, not by the example.

If a brief says "build a sign-in page," do not assume it should look like the section 8 sample. Ask the brief, look at the reference the user provided, or default to the simplest layout that satisfies the requirements.

## 1. Theme & scope setup

Production HTML always wraps the app in two things:

```html
<body class="spring-ui-jupiter">
  <div class="scope-spring">
    <!-- app -->
  </div>
</body>
```

- `spring-ui-jupiter` is a theme name on `<body>`. RingCentral ships several themes (`junoLight`, `light`, `dark`, `highContrast`, `jupiter`); the body class selects which `--sui-*` CSS variables resolve.
- `scope-spring` is a CSS scope class that the Spring stylesheet keys off of.

**In our React demos** we use `<ThemeProvider theme={suiLight}>` from `@ringcentral/spring-ui` instead of setting body classes manually:

```tsx
// src/main.tsx
import { ThemeProvider, suiLight } from "@ringcentral/spring-ui";

<ThemeProvider theme={suiLight}>
  <App />
</ThemeProvider>
```

`ThemeProvider` injects a wrapper div with the right scope class plus a `<style>` block of CSS variables — same effect as the prod body class, no manual setup needed.

## 2. The compiled Spring class structure (read this before reverse-engineering anything)

Every Spring React component compiles to a deterministic class string of the form:

```
sui-<component> sui-<component>-root [sui-<component>-<variant>] [sui-<component>-<color>] [sui-<component>-<size>] [sui-<component>-<variant>-<color>] [sui-<component>-<variant>-<size>] [sui-<component>-full-width]
```

Example: a primary contained xlarge full-width button compiles to

```
sui-button sui-button-root sui-button-contained sui-button-primary sui-button-xlarge
sui-button-contained-primary sui-button-contained-xlarge sui-button-full-width
```

What this means in practice:

- **Don't write these classes by hand.** Use the React component (`<Button variant="contained" color="primary" size="xlarge" fullWidth>`) — Spring emits the full class string for you.
- **Recognize them when reading prod HTML.** When you see `sui-button-contained-primary sui-button-xlarge sui-button-full-width`, translate it back to props.
- **Layout/color overrides go in `className`**, not by editing the compiled classes. The pattern in prod is to add Tailwind utilities + a single typography class:

  ```html
  <button class="sui-button sui-button-root sui-button-outlined sui-button-neutral sui-button-xlarge
                 sui-button-outlined-neutral sui-button-outlined-xlarge sui-button-full-width
                 typography-subtitle text-neutral-b0">
  ```

  → becomes
  ```tsx
  <Button variant="outlined" color="neutral" size="xlarge" fullWidth
          className="typography-subtitle text-neutral-b0">
  ```

The same pattern applies to `sui-text`, `sui-icon`, `sui-link`, `sui-checkbox`, `sui-text-field`, etc. — variant, color, size, and full-width are the four axes.

## 3. Color tokens

The `@ringcentral/spring-theme/tailwind` plugin (already wired in `tailwind.config.cjs`) generates Tailwind color utilities of the form `<utility>-<palette>-<shade>`. These are **the only color names that work** — anything else is silently no-op.

### Neutral palette (the most common)

Two scales, both running darker → lighter as the number grows:

| Token            | RGB                | Use                                         |
|------------------|--------------------|---------------------------------------------|
| `neutral-b0`     | `rgb(0,0,0)`       | True black; primary text, button labels     |
| `neutral-b1`     | `rgb(50,52,57)`    | Near-black body text                        |
| `neutral-b2`     | `rgb(114,117,122)` | Mid gray; secondary text, footer, hints     |
| `neutral-b3`     | `rgb(158,159,164)` | Light gray; disabled state                  |
| `neutral-b4`     | `rgb(221,223,229)` | Very light gray; dividers, disabled bg      |
| `neutral-b5`     | `rgb(245,246,249)` | Almost white; subtle surface tint           |
| `neutral-base`   | `rgb(255,255,255)` | White surface                               |
| `neutral-w0`     | `rgb(255,255,255)` | White (used for borders on light bgs)       |

Apply as `text-neutral-b0`, `bg-neutral-b5`, `border-neutral-w0`, etc.

### Alpha variants

Most colors expose `-t10`, `-t20`, `-t50`, `-t80` translucent variants, e.g. `bg-neutral-b0-t10` (black at 10% opacity), `bg-neutral-w0-t80` (white at 80%). Used for translucent overlays.

### Semantic palettes

Same pattern: `primary-b`, `primary-f`, `danger`, `danger-f`, `success`, `success-f`, `warning`, `warning-f`, `ai`, plus `*-high-contrast` variants and `*-t10/t20` alphas. The `b` suffix is the background variant, `f` is the foreground variant — typically use `bg-primary-b text-primary-f` together.

### What NOT to write

```
text-sui-neutral-f01     ← made-up; produces no styling
bg-sui-interactive-b03   ← made-up
border-sui-neutral-l02   ← made-up
```

These look plausible but the plugin does not emit them. If you see them in a codebase, replace with the real tokens above.

## 4. Typography classes

Typography is exposed as **component classes** (not utility prefixes) by the same plugin. Each class sets `font-size + font-weight + line-height + text-decoration + text-transform + font-family` in one go via the underlying CSS variables.

| Class                          | Approx | Use for                                |
|--------------------------------|--------|----------------------------------------|
| `typography-display1`          | XL     | Hero displays                          |
| `typography-display2`          | L      | Large displays                         |
| `typography-display3`          | 1.25rem semibold | Marketing taglines, page hero |
| `typography-title`             | M      | Section titles, card row headers       |
| `typography-subtitle`          | base   | Subtitles, button label overrides      |
| `typography-subtitleBold`      | base bold | Emphasized subtitles                |
| `typography-subtitleMini`      | small  | Smaller button text                    |
| `typography-mainText`          | body   | Normal body copy                       |
| `typography-label`             | label  | Form labels                            |
| `typography-labelSemiBold`     | label bold | Emphasized labels                  |
| `typography-detail`            | tiny   | Captions, helper text                  |
| `typography-descriptor`        | 0.75rem 400 | Footers, version strings, hints   |
| `typography-descriptorMini`    | tinier | Footer links, micro-copy               |
| `typography-descriptorMiniSemiBold` | tinier bold | Emphasized micro-copy         |

Combine freely with color tokens: `typography-title text-neutral-b0`, `typography-descriptor text-neutral-b2`, `typography-display3 text-neutral-b0`.

> **Do not stack Tailwind weight utilities (`font-bold`, `font-semibold`, `font-medium`) on `typography-*` classes.** Each typography token already encodes its own font-weight (e.g. `typography-display3` → Inter Semi Bold). Adding `font-bold` overrides the token and breaks the design system contract. If a heavier or lighter weight is needed, pick a different typography token, don't override the weight.

## 5. Layout patterns observed in prod

Prod is **Tailwind-utility heavy** but does not use Tailwind for everything. The convention is:

1. **Layout** (flex, gap, padding, width) → Tailwind utilities, often with arbitrary pixel values
2. **Color** → Spring color tokens (`text-neutral-b0`, `border-neutral-w0`)
3. **Typography** → Spring typography classes (`typography-title`)

### Pixel-pinned widths

RingCentral surfaces are almost never fluid. You'll see hard widths like `w-[424px]`, `w-[360px]`, `w-[640px]`. Use Tailwind's arbitrary value syntax — do not invent percentage approximations.


## 6. Test automation conventions

Every interactive element in prod gets two data attributes:

- `data-test-automation-id="<unique-id>"` — globally unique selector for E2E tests
- `data-type="<page>-<element>-<role>"` — semantic grouping for analytics / instrumentation

Example IDs you'll see across surfaces:

| Element                | `data-test-automation-id`                       |
|------------------------|-------------------------------------------------|
| Main page wrapper      | `login-main`, `settings-main`, etc.             |
| Brand logo container   | `<page>-brand-logo`                             |
| Page heading           | `<page>-title`                                  |
| Primary CTA            | `<page>-enter`, `<feature>-submit`              |
| Secondary action       | descriptive (e.g. `join-meet-without-login`)    |
| Field input            | `<page>-<field>-input`                          |
| Cookie / OneTrust link | `oneTrust-cookie-preference`                    |
| Footer                 | `<page>-footer`                                 |
| Version string         | `<page>-version`                                |

**Mirror these in demos** — screenshots, Playwright tests, and content reviews stay portable when the hierarchy of `data-test-automation-id` matches prod.

## 7. Tailwind config requirements

For all the above to work, the artifact's `tailwind.config.cjs` must:

```js
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./index.html",
    "node_modules/@ringcentral/spring-ui/**/*.js",   // ← required so Spring's compiled classes are scanned
  ],
  plugins: [
    require("@ringcentral/spring-theme/tailwind")(),  // ← emits color + typography utilities
  ],
};
```

Without the spring-theme plugin, `text-neutral-b0`, `typography-display3`, etc. do not exist. Without the spring-ui content path, the compiled `sui-button-*` classes get tree-shaken away.

Tailwind version must be **v3**. Spring UI v1.x is built against the v3 plugin API; v4 is incompatible (the workspace catalog may pin v4 — check that your artifact's `package.json` resolves `tailwindcss` to v3.4.x).


## 8. Syntax reference: combining the pieces

> **This is not a layout to copy.** The snippet below is a single contrived example showing how `ThemeProvider`, Spring components (`Button`, `Link`), color tokens (`text-neutral-b0`, `text-neutral-b2`), typography classes (`typography-display3`, `typography-mainText`, `typography-subtitle`), and `data-test-automation-id`s coexist in one React file. The wrapper structure, card chrome, button choices, and footer are illustrative filler — your brief decides actual layout, content, and brand chrome.

```tsx
import { Button, Link, ThemeProvider, suiLight } from "@ringcentral/spring-ui";

<ThemeProvider theme={suiLight}>
  <main
    role="main"
    data-test-automation-id="example-main"
    className="flex flex-col w-screen h-screen items-center justify-center bg-neutral-b5"
  >
    <section
      data-test-automation-id="example-card"
      className="box-border flex flex-col w-[424px] p-8 rounded-[8px] bg-neutral-base"
    >
      <h1 className="typography-display3 text-neutral-b0">
        Example heading
      </h1>
      <p className="typography-mainText text-neutral-b2 mt-2">
        Example body copy goes here.
      </p>
      <div className="flex flex-col w-full gap-3 mt-6">
        <Button variant="contained" color="primary" size="xlarge" fullWidth
                data-test-automation-id="example-primary-cta"
                onClick={handler}>
          Primary action
        </Button>
        <Button variant="outlined" color="neutral" size="xlarge" fullWidth
                className="typography-subtitle text-neutral-b0"
                data-test-automation-id="example-secondary-cta"
                onClick={handler}>
          Secondary action
        </Button>
      </div>
      <Link variant="primary" underline="always" onClick={handler}
            className="mt-4 self-center">
        <span className="typography-descriptorMini">Example link</span>
      </Link>
    </section>
  </main>
</ThemeProvider>
```

Things to take from this example:
- `ThemeProvider` wraps the tree once.
- Layout (`flex`, `gap`, `p-8`, `w-[424px]`) is Tailwind; color (`text-neutral-b0`, `bg-neutral-base`) is Spring tokens; type sizing (`typography-display3`, `typography-mainText`) is Spring classes.
- Spring components take their visual axes (`variant`, `color`, `size`, `fullWidth`) as props — never hand-write `sui-button-*` strings.
- `className` on a Spring component is for *overrides on top of* the compiled Spring classes (e.g. layout utilities, a typography class, a text color), not for replacing them.
- Every interactive surface carries a `data-test-automation-id`.

Things **not** to take from this example:
- The card width, padding, background color, border radius, or whether a card exists at all.
- Whether the page has a primary + secondary button stack, a single CTA, or no buttons.
- Whether there's a footer link, a logo, a heading style, or any specific brand chrome.
- The visual tone (flat, glassy, gradient, dark, etc.).

Those are all decided by the user's brief, the design reference they provide, or — if neither — the simplest layout that satisfies the requirements.
