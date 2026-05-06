// Single source of truth for the FAB screen picker.
//
// Each entry is `{ flow, step }`. The FAB groups by `flow` (preserving the
// order in which each flow first appears) and renders:
//   - the flow name as a `MenuHeader`
//   - each step as a `MenuItem`
//
// Adding a new screen:
//   1. Append `{ flow: "<Flow name>", step: "<Step name>" }` to SCREENS.
//   2. If the flow is new, no extra wiring is needed — the FAB auto-creates
//      a new `MenuHeader` group for it.
//   3. Add a matching branch in your renderer (see SCREENS.md anchor comment
//      convention).

export const SCREENS = [
  { flow: "App", step: "Screen A" },
  { flow: "App", step: "Screen B" },
] as const;

export type ScreenDef = (typeof SCREENS)[number];
export type ScreenId = `${ScreenDef["flow"]}/${ScreenDef["step"]}`;

export const screenId = (s: { flow: string; step: string }): string =>
  `${s.flow}/${s.step}`;

export const DEFAULT_SCREEN: ScreenId =
  `${SCREENS[0].flow}/${SCREENS[0].step}` as ScreenId;

export function groupScreensByFlow(
  screens: readonly { flow: string; step: string }[],
): { flow: string; steps: { step: string; id: string }[] }[] {
  const order: string[] = [];
  const map = new Map<string, { step: string; id: string }[]>();
  for (const s of screens) {
    if (!map.has(s.flow)) {
      order.push(s.flow);
      map.set(s.flow, []);
    }
    map.get(s.flow)!.push({ step: s.step, id: screenId(s) });
  }
  return order.map((flow) => ({ flow, steps: map.get(flow)! }));
}
