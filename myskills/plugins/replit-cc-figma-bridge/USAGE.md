# Using spring-screen-bridge

Three entry points cover everything the skill does. Pick the one that matches your task and use the prompt template verbatim — the agent will load the right module(s) on its own.

## Screen identity

A **screen** is `{ flow, step }`:

- **Flow** — top-level grouping, e.g. `Sign in`, `Home`, `Settings`. Renders as a `MenuHeader` in the FAB.
- **Step** — leaf within the flow, e.g. `Email`, `Password`, `Verify`. Renders as a `MenuItem` under that flow's header.
- **Screen ID** — the canonical string `"<Flow>/<Step>"` (e.g. `"Sign in/Email"`). This is what the host component branches on and what you reference in prompts.

Use the screen ID (`"Sign in/Email"`) when referring to a screen in any prompt below. You don't need to specify a separate value/identifier — the ID is derived from Flow and Step.

## 1. Build a new RingCentral demo

Use when there's no artifact yet. Replit's artifact tooling creates the folder, registers the workflow, and wires the route automatically; this skill then writes the screens, installs the FAB, and creates `SCREENS.md`.

> Build a new RingCentral demo artifact called `<name>`. Use the spring-screen-bridge skill for the implementation. Screens to register in the FAB (Flow / Step):
> - `Sign in / Email` (default)
> - `Sign in / Password`
> - `Sign in / Verify`
>
> Brief: <one paragraph + any reference screenshot or URL>. After implementation, run typecheck and confirm each screen renders.

Modules consulted: `build-in-replit.md`, `screen-picker.md` (install).

## 2. Add a screen to an existing demo

Use when `src/screens.ts`, `src/presentation-config/`, and `SCREENS.md` already exist.

> Use the spring-screen-bridge skill to add a screen to `artifacts/<name>`.
> - Flow: `<Flow name>` (e.g. `Sign in`, or a new flow like `Home` — if it doesn't exist yet, the FAB will auto-create the group)
> - Step: `<Step name>` (e.g. `Verify`)
> - Behavior: <one paragraph: what's on the screen, where Next/Back go, any new asset references>
>
> Update `SCREENS.md` (recompute drifted line ranges) and run typecheck.

Only Flow and Step are required inputs. The screen ID (`"<Flow>/<Step>"`) and FAB grouping are derived automatically — no separate identifier, no FAB or context edits.

Modules consulted: `screen-picker.md` (Operation 2). `build-in-replit.md` is consulted ad hoc if the new JSX needs unfamiliar Spring components.

## 3. Export a screen to Figma

Use when screens already exist in code and you want a Figma frame.

> Use the spring-screen-bridge skill to export "`<Flow> / <Step>`" from `artifacts/<name>` to Figma. See `artifacts/<name>/SCREENS.md` for source location and Static assets. Upload each asset and bind the returned `imageHash` — do not substitute placeholders. Place the frame in `<file or page name>`.

Modules consulted: `export-to-figma.md`, plus `SCREENS.md` in the artifact.

## Why these prompts work

- They name the skill explicitly so the loader pulls in `SKILL.md` and the right module without you pointing at files.
- They identify screens by their **Flow / Step** pair — the same identifier used in the FAB menu, the `SCREENS` registry in code, anchor comments, and `SCREENS.md` rows. The agent greps from there.
- They reference `SCREENS.md` instead of file paths, so they keep working when line ranges drift.
- They end with a verifier (typecheck for build/add, "no placeholder assets" for export) so silent failures surface immediately.

## End-to-end example

Add a verify-code step to a sign-in demo, then export it:

> Use the spring-screen-bridge skill to add a screen to `artifacts/<your-demo>`.
> - Flow: `Sign in`
> - Step: `Verify`
> - Behavior: After password submit, user lands here. Six-digit code input, Resend link, Back link to the previous step. On submit, advance to a stub success screen.
>
> Update `SCREENS.md` and run typecheck.

Then in a follow-up turn:

> Use the spring-screen-bridge skill to export "`Sign in / Verify`" from `artifacts/<your-demo>` to Figma. See `artifacts/<your-demo>/SCREENS.md` for source and assets.

Adding a screen in a brand-new flow looks identical — just use a Flow name that isn't in `SCREENS` yet:

> Use the spring-screen-bridge skill to add a screen to `artifacts/<your-demo>`.
> - Flow: `Home`
> - Step: `Dashboard`
> - Behavior: Post-sign-in landing. Greeting, primary nav, empty state placeholder for content.
>
> Update `SCREENS.md` and run typecheck.

The FAB will render a new `Home` section header above the existing `Sign in` section. Then export it the same way:

> Use the spring-screen-bridge skill to export "`Home / Dashboard`" from `artifacts/<your-demo>` to Figma. See `artifacts/<your-demo>/SCREENS.md` for source and assets.

That's the full loop: register → implement → export, with `Flow / Step` as the only handle you need to remember.
