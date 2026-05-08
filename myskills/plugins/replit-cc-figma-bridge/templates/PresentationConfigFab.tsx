import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  IconButton,
  Menu as MenuRaw,
  MenuHeader as MenuHeaderRaw,
  MenuItem as MenuItemRaw,
  MenuItemText as MenuItemTextRaw,
  MenuDivider as MenuDividerRaw,
} from "@ringcentral/spring-ui";
import SettingsMd from "@ringcentral/spring-icon/SettingsMd";
import CaretRightMd from "@ringcentral/spring-icon/CaretRightMd";
import { usePresentationConfig, type ThemeOption } from "./PresentationConfigContext";
import { SCREENS, groupScreensByFlow, type ScreenId } from "../screens";
import {
  buildExportPrompt,
  groupSnapshotsByScreen,
  loadSnapshots,
  makeSnapshotId,
  remapSnapshotScreenIds,
  renameSnapshotInList,
  saveSnapshots,
  type ScreenStateAdapter,
  type Snapshot,
} from "./snapshots";

// Spring UI 1.9.x + React 19: cast Menu primitives to ComponentType<any> to
// satisfy stricter children/intrinsic-attribute typing. Do not remove these
// casts unless you've confirmed the Spring UI types have been updated.
const Menu = MenuRaw as ComponentType<any>;
const MenuHeader = MenuHeaderRaw as ComponentType<any>;
const MenuItem = MenuItemRaw as ComponentType<any>;
const MenuItemText = MenuItemTextRaw as ComponentType<any>;
const MenuDivider = MenuDividerRaw as ComponentType<any>;

// ─── Optional add-on props ──────────────────────────────────────────────
//
// The FAB is fully usable with no props (just renders the Theme section +
// Export submenu). The optional props below light up two add-on features
// documented in `modules/snapshots.md` and `modules/rename-in-app.md`:
//
//   - `screenStateAdapter` enables runtime SNAPSHOTS: each step in the
//     Export submenu gets a "+ Snapshot" affordance (only when the live
//     UI is on that screen) and any saved snapshots render as inline
//     indented children. A snapshot is a captured-state variant of a
//     code-defined screen; storage is `localStorage` only.
//
//   - `enableRename` lights up pencil-icon affordances next to flows,
//     steps, and snapshots. Snapshot renames are local; flow / step
//     renames POST to `/api/screens/rename-flow` and `/rename-step`
//     (mount via `registerScreenRenameRoutes` from the server template).
//     After a successful source rewrite, Vite hot-reloads the page.
export interface PresentationConfigFabProps<TState = unknown> {
  screenStateAdapter?: ScreenStateAdapter<TState>;
  enableRename?: boolean;
  // Override snapshot localStorage key (default: "fab-snapshots-v1").
  snapshotsStorageKey?: string;
}

export function PresentationConfigFab<TState = unknown>({
  screenStateAdapter,
  enableRename = false,
  snapshotsStorageKey,
}: PresentationConfigFabProps<TState> = {}) {
  const fabRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  // The Export submenu opens as a 2nd-level Menu anchored to the Export
  // MenuItem. Tracking its anchor element separately lets it stay open
  // while the main menu remains open behind it.
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const exportOpen = Boolean(exportAnchor);

  const { themeOption, setThemeOption, screen, setScreen } =
    usePresentationConfig();

  const closeAll = () => {
    setExportAnchor(null);
    setOpen(false);
  };
  const handleClose = () => setOpen(false);

  // ─── Snapshot state (only meaningful when adapter is provided) ──────
  const [snapshots, setSnapshots] = useState<Snapshot<TState>[]>(() =>
    screenStateAdapter ? loadSnapshots<TState>(snapshotsStorageKey) : [],
  );
  useEffect(() => {
    if (screenStateAdapter) saveSnapshots(snapshots, snapshotsStorageKey);
  }, [snapshots, screenStateAdapter, snapshotsStorageKey]);
  const snapshotsByScreen = useMemo(
    () => groupSnapshotsByScreen(snapshots),
    [snapshots],
  );
  // Which snapshot (if any) the live UI currently matches. Pure state
  // comparison — any user edit immediately clears the indicator without
  // bespoke "last applied" bookkeeping.
  const appliedSnapshotId = useMemo(() => {
    if (!screenStateAdapter) return null;
    for (const snap of snapshots) {
      if (snap.screenId !== screen) continue;
      if (screenStateAdapter.matches(snap.state)) return snap.id;
    }
    return null;
  }, [snapshots, screen, screenStateAdapter]);

  function captureCurrentSnapshot(screenId: string) {
    if (!screenStateAdapter) return;
    const name = window.prompt("Snapshot name");
    if (!name || !name.trim()) return;
    const snap: Snapshot<TState> = {
      id: makeSnapshotId(),
      screenId,
      name: name.trim(),
      createdAt: Date.now(),
      state: screenStateAdapter.capture(),
    };
    setSnapshots((prev) => [...prev, snap]);
  }

  function applySnapshot(snap: Snapshot<TState>) {
    if (!screenStateAdapter) return;
    screenStateAdapter.apply(snap.state);
    if (screen !== snap.screenId) setScreen(snap.screenId as ScreenId);
  }

  function deleteSnapshot(id: string) {
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
  }

  function renameSnapshotPrompt(snap: Snapshot<TState>) {
    const next = window.prompt("Rename snapshot", snap.name);
    if (!next || !next.trim() || next.trim() === snap.name) return;
    setSnapshots((prev) => renameSnapshotInList(prev, snap.id, next.trim()));
  }

  // ─── Source-rewriting renames (flow / step) ─────────────────────────
  async function postRename(
    url: string,
    body: object,
    successMsg: string,
  ): Promise<void> {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        remap?: Record<string, string>;
      };
      if (!res.ok || data.ok === false) {
        window.alert(data.message ?? `Rename failed (${res.status})`);
        return;
      }
      if (data.remap && Object.keys(data.remap).length > 0) {
        // Patch snapshot screenIds BEFORE Vite's reload, so the menu
        // re-renders with new names + correctly-remapped snapshots.
        // Functional setState so an in-flight snapshot edit isn't
        // overwritten by a stale closure.
        setSnapshots((prev) => {
          const remapped = remapSnapshotScreenIds(prev, data.remap!);
          saveSnapshots(remapped, snapshotsStorageKey);
          return remapped;
        });
      }
      // eslint-disable-next-line no-console
      console.log(successMsg);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    }
  }

  function renameFlowPrompt(flow: string) {
    const next = window.prompt(`Rename flow "${flow}"`, flow);
    if (!next || !next.trim() || next.trim() === flow) return;
    void postRename(
      "/api/screens/rename-flow",
      { flow, newFlow: next.trim() },
      `Renamed flow ${flow} → ${next.trim()}`,
    );
  }

  // ─── Share: copy "optimal export prompt" to clipboard ──────────────
  // Always available — for both plain steps and snapshots — so a user
  // can paste a paste-ready prompt into Claude Code (or any agent that
  // loads this skill) and get the screen / variant exported to Figma.
  async function copyExportPrompt(
    flow: string,
    step: string,
    snapshot?: Snapshot<TState>,
  ) {
    const text = buildExportPrompt({
      flow,
      step,
      snapshot,
      describeDelta: screenStateAdapter?.describePromptDelta,
    });
    try {
      await navigator.clipboard.writeText(text);
      // eslint-disable-next-line no-console
      console.log(
        snapshot
          ? `Copied export prompt for ${flow} / ${step} — ${snapshot.name}`
          : `Copied export prompt for ${flow} / ${step}`,
      );
    } catch {
      // Clipboard API can reject in non-secure contexts; fall back to
      // window.prompt so the user can copy manually.
      window.prompt("Copy this prompt:", text);
    }
  }

  function renameStepPrompt(flow: string, step: string) {
    const next = window.prompt(`Rename step "${step}"`, step);
    if (!next || !next.trim() || next.trim() === step) return;
    void postRename(
      "/api/screens/rename-step",
      { flow, step, newStep: next.trim() },
      `Renamed step ${flow}/${step} → ${flow}/${next.trim()}`,
    );
  }

  // List every Spring-supported theme. `@ringcentral/spring-theme` ships
  // four themes total; juno dark is not exported, so it is intentionally
  // absent. Do not add a fake/aliased "Juno Dark" option.
  const themeItems: { label: string; value: ThemeOption }[] = [
    { label: "Juno Light", value: "junoLight" },
    { label: "Light", value: "light" },
    { label: "Dark", value: "dark" },
    { label: "High Contrast", value: "highContrast" },
  ];

  // Flows are derived from `SCREENS` in order of first appearance.
  // To add a screen: append to SCREENS in `screens.ts` — no edits here.
  const flowGroups = groupScreensByFlow(SCREENS);

  // Pencil-icon button rendered inline next to a label. Hidden until
  // hover/focus on its parent (which must carry the `group` class).
  const pencilButton = (
    label: string,
    onClick: (e: React.MouseEvent) => void,
  ) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      aria-label={label}
      title={label}
      style={{
        marginLeft: 8,
        width: 20,
        height: 20,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: 0,
        background: "transparent",
        border: 0,
        borderRadius: 4,
        cursor: "pointer",
      }}
      className="fab-pencil"
    >
      ✎
    </button>
  );

  return (
    <>
      {/* CSS-only hover reveal for the inline pencil/delete buttons. */}
      <style>{`
        .fab-row:hover .fab-pencil,
        .fab-row:focus-within .fab-pencil { opacity: 0.7; }
        .fab-pencil:hover { opacity: 1 !important; background: rgba(0,0,0,0.06); }
      `}</style>
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
        }}
      >
        <IconButton
          ref={fabRef}
          symbol={SettingsMd}
          size="xlarge"
          shape="squircle"
          variant="contained"
          aria-label="Presentation configuration"
          onClick={() => setOpen((prev) => !prev)}
        />
      </div>
      <Menu
        open={open}
        anchorEl={fabRef.current}
        onClose={() => {
          // Don't tear down the main menu (and with it, the Export
          // anchor) while the submenu is open — let the submenu's own
          // onClose handle dismissal. Otherwise Spring's clickaway fires
          // when the submenu opens and the whole stack collapses.
          if (!exportOpen) setOpen(false);
        }}
        placement="left"
        PopperProps={{ offset: 8 }}
      >
        {/* ─── Customizable area ──────────────────────────────────────
            Add any project-specific items above the Export divider —
            switches, radios, links, etc. The Theme section below is a
            default-shipped example; remove or replace it freely. The
            only required, fixed element of the FAB is the Export item
            at the bottom (with its divider above), which opens the
            screen list as a 2nd-level menu.
            ──────────────────────────────────────────────────────────── */}
        <MenuHeader
          divider={false}
          className="justify-start px-4 typography-labelSemiBold h-8 text-neutral-b2"
        >
          Theme
        </MenuHeader>
        {themeItems.map((item) => (
          <MenuItem
            key={item.value}
            selected={themeOption === item.value}
            onClick={() => {
              setThemeOption(item.value);
              handleClose();
            }}
          >
            <MenuItemText>{item.label}</MenuItemText>
          </MenuItem>
        ))}

        {/* ─── Export (canonical, always last) ────────────────────────
            Required item shipped by the bridge skill. Always rendered
            as the last menu item, with a divider above it. Opens a
            2nd-level menu listing every screen registered in `SCREENS`,
            grouped by flow. Selecting a screen calls `setScreen(<id>)`
            so the host component renders that screen. Do not add
            anything below this item.
            ──────────────────────────────────────────────────────────── */}
        <MenuDivider />
        {/* `autoClose={false}` is required: Spring `MenuItem` closes
            its parent Menu by default, which would unmount the Export
            item and yank the submenu's anchor before it can open. */}
        <MenuItem
          autoClose={false}
          onClick={(e: React.MouseEvent<HTMLElement>) =>
            setExportAnchor((prev) => (prev ? null : e.currentTarget))
          }
        >
          <MenuItemText>Export</MenuItemText>
          <CaretRightMd width={16} height={16} />
        </MenuItem>
      </Menu>

      {/* 2nd-level Export submenu: lists every screen, grouped by flow.
          When `screenStateAdapter` is supplied, snapshots render
          inline-indented under each step and the current step gets a
          "+ Snapshot" affordance. When `enableRename` is true, pencil
          icons appear on hover for flows / steps / snapshots. */}
      <Menu
        open={exportOpen}
        anchorEl={exportAnchor}
        onClose={() => setExportAnchor(null)}
        placement="left-start"
        PopperProps={{ offset: 8 }}
      >
        {flowGroups.map((group, idx) => (
          <Fragment key={group.flow}>
            {idx > 0 && <MenuDivider />}
            <MenuHeader
              divider={false}
              className="justify-start px-4 typography-labelSemiBold h-8 text-neutral-b2 fab-row"
            >
              <span style={{ flex: 1 }}>{group.flow}</span>
              {enableRename &&
                pencilButton(`Rename flow ${group.flow}`, () =>
                  renameFlowPrompt(group.flow),
                )}
            </MenuHeader>
            {group.steps.map((s) => {
              const isCurrent = screen === s.id;
              const stepSnapshots = snapshotsByScreen.get(s.id) ?? [];
              // The parent step is "selected" only when the user is on
              // its screen AND no snapshot of it matches the live state
              // (i.e. they're viewing the plain code screen, not one
              // of its saved variants).
              const stepSelected = isCurrent && appliedSnapshotId === null;
              return (
                <Fragment key={s.id}>
                  <MenuItem
                    selected={stepSelected}
                    className="fab-row"
                    onClick={() => {
                      if (!isCurrent) {
                        setScreen(s.id as ScreenId);
                        closeAll();
                      } else if (screenStateAdapter?.reset) {
                        // Already on this screen — clicking the parent
                        // step means "go back to the pristine code state
                        // of this screen". Makes the parent feel like
                        // a restore point and snapshots feel like saved
                        // variants of it.
                        screenStateAdapter.reset();
                        closeAll();
                      } else {
                        closeAll();
                      }
                    }}
                  >
                    <MenuItemText>{s.step}</MenuItemText>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void copyExportPrompt(group.flow, s.step);
                        closeAll();
                      }}
                      aria-label={`Copy export prompt for ${s.step}`}
                      title="Copy export prompt"
                      className="fab-pencil"
                      style={{
                        marginLeft: 8,
                        width: 20,
                        height: 20,
                        background: "transparent",
                        border: 0,
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      ⇪
                    </button>
                    {enableRename &&
                      pencilButton(`Rename step ${s.step}`, () =>
                        renameStepPrompt(group.flow, s.step),
                      )}
                  </MenuItem>
                  {/* Snapshots — inline indented, NOT a 3rd-level
                      Spring submenu. */}
                  {screenStateAdapter &&
                    stepSnapshots.map((snap) => (
                      <MenuItem
                        key={snap.id}
                        selected={appliedSnapshotId === snap.id}
                        className="fab-row"
                        onClick={() => {
                          applySnapshot(snap);
                          closeAll();
                        }}
                      >
                        <MenuItemText>
                          <span style={{ paddingLeft: 20 }}>{snap.name}</span>
                        </MenuItemText>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void copyExportPrompt(group.flow, s.step, snap);
                            closeAll();
                          }}
                          aria-label={`Copy export prompt for ${snap.name}`}
                          title="Copy export prompt"
                          className="fab-pencil"
                          style={{
                            marginLeft: 8,
                            width: 20,
                            height: 20,
                            background: "transparent",
                            border: 0,
                            borderRadius: 4,
                            cursor: "pointer",
                          }}
                        >
                          ⇪
                        </button>
                        {enableRename &&
                          pencilButton(`Rename snapshot ${snap.name}`, () =>
                            renameSnapshotPrompt(snap),
                          )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSnapshot(snap.id);
                          }}
                          aria-label={`Delete snapshot ${snap.name}`}
                          title="Delete snapshot"
                          className="fab-pencil"
                          style={{
                            marginLeft: 4,
                            width: 20,
                            height: 20,
                            background: "transparent",
                            border: 0,
                            borderRadius: 4,
                            cursor: "pointer",
                          }}
                        >
                          ×
                        </button>
                      </MenuItem>
                    ))}
                  {/* "+ Snapshot" affordance — only on the current
                      screen's step, since saving any other step's
                      state isn't possible from here. */}
                  {screenStateAdapter && isCurrent && (
                    <MenuItem
                      onClick={() => {
                        captureCurrentSnapshot(s.id);
                        closeAll();
                      }}
                    >
                      <MenuItemText>
                        <span
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: 6,
                            color: "var(--interactive-b02, #0040dd)",
                          }}
                        >
                          + Snapshot
                        </span>
                      </MenuItemText>
                    </MenuItem>
                  )}
                </Fragment>
              );
            })}
          </Fragment>
        ))}
      </Menu>
    </>
  );
}
