// Runtime "snapshot" of an existing code screen.
//
// A snapshot captures the current UI state on top of a code-defined screen
// (a row in `src/screens.ts`). It is NOT a new screen — it has no own .tsx
// file, no Figma frame, and lives only in this browser's localStorage. It
// is rendered as an indented child of its parent step in the FAB Export
// submenu.
//
// `TState` is project-defined (whatever your app considers replayable: nav
// order, theme, scroll position, etc.). The store treats it as opaque.

const DEFAULT_STORAGE_KEY = "fab-snapshots-v1";

export interface Snapshot<TState = unknown> {
  id: string;
  // Canonical screen id from `SCREENS`, e.g. "Sign in/Email".
  screenId: string;
  // User-given short name shown in the menu, e.g. "Empty state".
  name: string;
  createdAt: number;
  state: TState;
}

export function loadSnapshots<TState = unknown>(
  storageKey: string = DEFAULT_STORAGE_KEY,
): Snapshot<TState>[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is Snapshot<TState> =>
        !!s &&
        typeof s === "object" &&
        typeof s.id === "string" &&
        typeof s.screenId === "string" &&
        typeof s.name === "string" &&
        typeof s.createdAt === "number" &&
        "state" in s,
    );
  } catch {
    return [];
  }
}

export function saveSnapshots<TState = unknown>(
  snapshots: Snapshot<TState>[],
  storageKey: string = DEFAULT_STORAGE_KEY,
): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(snapshots));
  } catch {
    // ignore quota errors
  }
}

export function makeSnapshotId(): string {
  return `snap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function renameSnapshotInList<TState>(
  snapshots: Snapshot<TState>[],
  id: string,
  newName: string,
): Snapshot<TState>[] {
  return snapshots.map((s) => (s.id === id ? { ...s, name: newName } : s));
}

// Remap snapshot screenIds after a flow or step is renamed in the SCREENS
// registry. The map is { oldScreenId: newScreenId } — anything not in the
// map is left alone.
export function remapSnapshotScreenIds<TState>(
  snapshots: Snapshot<TState>[],
  remap: Record<string, string>,
): Snapshot<TState>[] {
  if (Object.keys(remap).length === 0) return snapshots;
  return snapshots.map((s) =>
    remap[s.screenId] ? { ...s, screenId: remap[s.screenId] } : s,
  );
}

export function groupSnapshotsByScreen<TState>(
  snapshots: Snapshot<TState>[],
): Map<string, Snapshot<TState>[]> {
  const map = new Map<string, Snapshot<TState>[]>();
  for (const s of snapshots) {
    const arr = map.get(s.screenId) ?? [];
    arr.push(s);
    map.set(s.screenId, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.createdAt - b.createdAt);
  }
  return map;
}

// ─── Screen-state adapter ───────────────────────────────────────────────
//
// The FAB doesn't know what your app's "state" is. The adapter is a small
// contract the host implements so the FAB can capture, apply, compare, and
// reset whatever state is meaningful for that project.
//
// Required: capture / apply / matches.
// Optional: reset — if provided, clicking the parent step while already on
// its route resets to pristine defaults (the parent becomes the snapshot's
// "restore point"). If omitted, clicking the parent step is a no-op when
// already on its route.

export interface ScreenStateAdapter<TState> {
  capture: () => TState;
  apply: (state: TState) => void;
  matches: (state: TState) => boolean;
  reset?: () => void;
  // Optional. Returns a human-readable, multi-line description of the
  // state's deltas vs the screen's pristine code defaults — used by the
  // FAB's per-snapshot "share" button to compose the optimal Figma-export
  // prompt for that variant. Return `null` if the state matches defaults
  // (the prompt collapses to the plain-step form). If omitted, the share
  // button on snapshots still works but without a state delta block.
  describePromptDelta?: (state: TState) => string | null;
}

// ─── Optimal export prompt builder ──────────────────────────────────────
//
// Used by the FAB's share button to compose a paste-ready prompt for an
// agent that has the replit-cc-figma-bridge skill loaded. Project-agnostic:
// the only project-specific piece is the optional `describePromptDelta`
// on the adapter.

export interface BuildExportPromptInput<TState = unknown> {
  flow: string;
  step: string;
  snapshot?: Snapshot<TState>;
  describeDelta?: (state: TState) => string | null;
}

export function buildExportPrompt<TState = unknown>(
  input: BuildExportPromptInput<TState>,
): string {
  const { flow, step, snapshot, describeDelta } = input;
  const label = `${flow} / ${step}`;
  // Three cases for the snapshot variant block:
  //   1. No snapshot                    → no block (plain step prompt).
  //   2. Snapshot + describeDelta given → if delta non-null, include it; if
  //                                       delta is null (snapshot matches
  //                                       defaults) collapse to plain step.
  //   3. Snapshot + no describeDelta    → generic fallback note. The host
  //                                       didn't tell us how to describe
  //                                       state, so we surface that the
  //                                       agent will need user input.
  let variantBlock = "";
  let frameName = label;
  if (snapshot) {
    if (describeDelta) {
      const delta = describeDelta(snapshot.state);
      if (delta) {
        frameName = `${label} — ${snapshot.name}`;
        variantBlock = `\n\nRender it with this state variant (saved locally as the "${snapshot.name}" snapshot):\n${delta}`;
      }
      // delta === null → snapshot matches defaults; fall through to plain.
    } else {
      frameName = `${label} — ${snapshot.name}`;
      variantBlock = `\n\nRender the "${snapshot.name}" variant of this screen (state details unavailable in this prompt — ask the user for specifics if needed).`;
    }
  }
  return [
    `Use the replit-cc-figma-bridge skill to export the "${label}" screen from this project to Figma.${variantBlock}`,
    "",
    "See `SCREENS.md` for the source location and Static assets — upload each asset and bind the returned `imageHash`, no placeholders.",
    "",
    `Place the frame in <your Figma file or page> and name it \`${frameName}\`.`,
  ].join("\n");
}
