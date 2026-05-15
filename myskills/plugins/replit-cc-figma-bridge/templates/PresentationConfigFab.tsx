import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  Button,
  IconButton,
  Menu as MenuRaw,
  MenuHeader as MenuHeaderRaw,
  MenuItem as MenuItemRaw,
  MenuItemText as MenuItemTextRaw,
  MenuDivider as MenuDividerRaw,
  TextField,
} from "@ringcentral/spring-ui";
import SettingsMd from "@ringcentral/spring-icon/SettingsMd";
import CaretRightMd from "@ringcentral/spring-icon/CaretRightMd";
// FAB chrome affordances (rename / copy-prompt / delete) intentionally use
// `lucide-react` rather than Spring icons. They are tool chrome, not Figma-
// translated screen content, so the "no lucide substitution" rule from
// implement-from-figma.md / build-in-replit.md does not apply here.
import { Link, Pencil, Share2, Trash2 } from "lucide-react";
import { usePresentationConfig, type ThemeOption } from "./PresentationConfigContext";
import { DEFAULT_SCREEN, SCREENS, groupScreensByFlow, type ScreenId } from "../screens";
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
// The FAB is fully usable with no props (just renders Theme + Export menus).
// The optional props below light up add-on features documented in
// `modules/snapshots.md` and `modules/rename-in-app.md`:
//
//   - `screenStateAdapter` — omit only when the host component is stateless;
//     pass an adapter whenever there is replayable state worth capturing.
//     Each step in the Export submenu gets a "+ Snapshot" affordance and
//     saved snapshots render as inline indented children. Storage is
//     `localStorage` only.
//
//   - `enableRename` (default: true) lights up pencil-icon rename
//     affordances next to flows, steps, and snapshots. Flow/step renames
//     POST to `/api/screens/rename-flow` and `/rename-step` (mount via
//     `registerScreenRenameRoutes` from the server template). Pass
//     `enableRename={false}` to hide the pencils for published demos where
//     the rename endpoints aren't mounted or shouldn't be reachable.
export interface PresentationConfigFabProps<TState = unknown> {
  screenStateAdapter?: ScreenStateAdapter<TState>;
  enableRename?: boolean;
  snapshotsStorageKey?: string;
}

export function PresentationConfigFab<TState = unknown>({
  screenStateAdapter,
  enableRename = true,
  snapshotsStorageKey,
}: PresentationConfigFabProps<TState> = {}) {
  const fabRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  // 2nd-level submenu anchors. Each tracks the triggering MenuItem element
  // and is used as a first-paint fallback before fabMenuPaperEl attaches.
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const exportOpen = Boolean(exportAnchor);
  const [themeAnchor, setThemeAnchor] = useState<HTMLElement | null>(null);
  const themeOpen = Boolean(themeAnchor);

  // Inner content <div> of the 1st menu's Paper — primary anchor for all
  // 2nd-level submenus. Anchoring to the Paper (not the triggering MenuItem)
  // keeps both menus' bottom edges aligned via placement="left-end".
  // Wired via PopperPaperProps.contentRef on the main menu below.
  // See modules/screen-picker.md "Menu positioning" for the full rationale.
  const [fabMenuPaperEl, setFabMenuPaperEl] = useState<HTMLElement | null>(null);

  const { themeOption, setThemeOption, screen, setScreen } =
    usePresentationConfig();

  const closeAll = () => {
    setExportAnchor(null);
    setThemeAnchor(null);
    setOpen(false);
    setFabMenuPaperEl(null);
  };

  // ─── Snapshot state ─────────────────────────────────────────────────
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
  // comparison — any user edit immediately clears the indicator.
  const appliedSnapshotId = useMemo(() => {
    if (!screenStateAdapter) return null;
    for (const snap of snapshots) {
      if (snap.screenId !== screen) continue;
      if (screenStateAdapter.matches(snap.state)) return snap.id;
    }
    return null;
  }, [snapshots, screen, screenStateAdapter]);

  // Reflow — Popper does not observe content-size changes inside a popper.
  // When snapshots are added/removed the Export submenu changes height;
  // dispatching a resize event after the DOM has reflowed forces Popper to
  // recompute, keeping the bottom edges pinned while the top grows upward.
  useEffect(() => {
    if (!exportOpen) return;
    const id = requestAnimationFrame(() =>
      window.dispatchEvent(new Event("resize")),
    );
    return () => cancelAnimationFrame(id);
  }, [snapshots.length, exportOpen]);

  // ─── Inline name-prompt ─────────────────────────────────────────────
  // Replaces window.prompt() with a Spring TextField + Button overlay —
  // accessible, non-blocking, and on-brand. Renders above all menus.
  const [namePrompt, setNamePrompt] = useState<{
    title: string;
    onConfirm: (value: string) => void;
  } | null>(null);
  const [namePromptValue, setNamePromptValue] = useState("");

  function openNamePrompt(
    title: string,
    defaultValue: string,
    onConfirm: (value: string) => void,
  ) {
    setNamePromptValue(defaultValue);
    setNamePrompt({ title, onConfirm });
  }

  function confirmNamePrompt() {
    const trimmed = namePromptValue.trim();
    if (!trimmed || !namePrompt) return;
    namePrompt.onConfirm(trimmed);
    setNamePrompt(null);
  }

  // ─── Snapshot operations ─────────────────────────────────────────────
  function captureCurrentSnapshot(screenId: string) {
    if (!screenStateAdapter) return;
    // Capture state immediately (before prompt or closeAll), so the snapshot
    // reflects the UI at the moment the user clicked "+ Snapshot".
    const state = screenStateAdapter.capture();
    openNamePrompt("Name this snapshot", "", (name) => {
      setSnapshots((prev) => [
        ...prev,
        { id: makeSnapshotId(), screenId, name, createdAt: Date.now(), state },
      ]);
    });
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
    openNamePrompt("Rename snapshot", snap.name, (next) => {
      if (next === snap.name) return;
      setSnapshots((prev) => renameSnapshotInList(prev, snap.id, next));
    });
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
        // Patch snapshot screenIds before Vite's hot-reload so the menu
        // re-renders with new names immediately.
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
    openNamePrompt(`Rename flow "${flow}"`, flow, (next) => {
      if (next === flow) return;
      void postRename(
        "/api/screens/rename-flow",
        { flow, newFlow: next },
        `Renamed flow ${flow} → ${next}`,
      );
    });
  }

  function renameStepPrompt(flow: string, step: string) {
    openNamePrompt(`Rename step "${step}"`, step, (next) => {
      if (next === step) return;
      void postRename(
        "/api/screens/rename-step",
        { flow, step, newStep: next },
        `Renamed step ${flow}/${step} → ${flow}/${next}`,
      );
    });
  }

  // ─── Share / deep-link ──────────────────────────────────────────────
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
      // Clipboard API can reject in non-secure contexts.
      window.prompt("Copy this prompt:", text);
    }
  }

  async function copyLink(screenId: ScreenId) {
    const url = new URL(window.location.href);
    if (screenId === DEFAULT_SCREEN) {
      url.searchParams.delete("screen");
    } else {
      url.searchParams.set("screen", screenId);
    }
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      window.prompt("Copy this link:", url.toString());
    }
  }

  const themeItems: { label: string; value: ThemeOption }[] = [
    { label: "Juno Light", value: "junoLight" },
    { label: "Light", value: "light" },
    { label: "Dark", value: "dark" },
    { label: "High Contrast", value: "highContrast" },
  ];

  const flowGroups = groupScreensByFlow(SCREENS);

  // Hover-revealed icon button used for FAB chrome affordances (rename,
  // share, copy-link, delete). Parent row must carry Tailwind's `group` class.
  const iconButton = (
    label: string,
    icon: React.ReactNode,
    onClick: (e: React.MouseEvent) => void,
    variant: "header" | "row" | "danger" = "row",
    extraMargin: "ml-1" | "ml-2" = "ml-1",
  ) => {
    const hover =
      variant === "header"
        ? "hover:bg-[#eef0f3] hover:text-[#323439]"
        : variant === "danger"
          ? "hover:bg-white hover:text-[#d70015]"
          : "hover:bg-white hover:text-[#323439]";
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick(e);
        }}
        aria-label={label}
        title={label}
        className={`${extraMargin} inline-flex h-5 w-5 items-center justify-center rounded-[6px] text-[#72757a] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 ${hover} transition-[opacity,background-color,color]`}
      >
        {icon}
      </button>
    );
  };

  return (
    <>
      {/* FAB button — fixed bottom-right. To reposition, edit the `style`
          on this wrapper div only; leave the IconButton props unchanged. */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999 }}>
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

      {/* 1st-level FAB menu — placement="top-end" opens the menu above the
          FAB button, right-edge aligned to the FAB. PopperPaperProps.contentRef
          captures the Paper's inner content div (fabMenuPaperEl) so 2nd-level
          submenus can use it as their anchor for bottom-edge alignment.
          onClose guard prevents Spring's clickaway from collapsing the stack
          when a 2nd-level submenu opens. */}
      <Menu
        open={open}
        anchorEl={fabRef.current}
        onClose={() => {
          if (!exportOpen && !themeOpen) {
            setOpen(false);
            setFabMenuPaperEl(null);
          }
        }}
        placement="top-end"
        PopperProps={{ offset: 8 }}
        PopperPaperProps={{ contentRef: setFabMenuPaperEl }}
      >
        {/* ─── Customizable area ──────────────────────────────────────
            Add project-specific items here — env switches, role pickers,
            layout pickers, links to docs, etc. Render ABOVE the Theme +
            Export pair. Do not insert anything between or below them.
            ──────────────────────────────────────────────────────────── */}

        {/* ─── Theme + Export (canonical last two items) ──────────────
            Theme is 2nd-to-last, Export is last; each preceded by a
            MenuDivider. Do not reorder or insert between them.
            ──────────────────────────────────────────────────────────── */}
        <MenuDivider />
        {/* autoClose={false}: Spring closes the parent menu on MenuItem
            click by default, which would unmount the anchor before the
            submenu opens. Both Theme and Export need this. */}
        <MenuItem
          autoClose={false}
          onClick={(e: React.MouseEvent<HTMLElement>) =>
            setThemeAnchor((prev) => (prev ? null : e.currentTarget))
          }
        >
          <MenuItemText>Theme</MenuItemText>
          <CaretRightMd width={16} height={16} />
        </MenuItem>
        <MenuDivider />
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

      {/* 2nd-level Export submenu.
          Anchored to fabMenuPaperEl (the 1st menu's Paper content div) rather
          than the Export MenuItem, so both menus share the same bottom edge.
          placement="left-end" pins the bottoms; the top extends upward as
          snapshots are added. maxHeight + overflowY bound the height to the
          viewport. The reflow useEffect above keeps Popper's position current
          as snapshot count changes. */}
      <Menu
        open={exportOpen}
        anchorEl={fabMenuPaperEl ?? exportAnchor}
        onClose={() => setExportAnchor(null)}
        placement="left-end"
        PopperProps={{ offset: 8 }}
        PopperPaperProps={{
          style: {
            width: "fit-content",
            minWidth: 0,
            maxHeight: "calc(100vh - 32px)",
            overflowY: "auto",
          },
        }}
      >
        {flowGroups.map((group, idx) => (
          <Fragment key={group.flow}>
            {idx > 0 && <MenuDivider />}
            <MenuHeader
              divider={false}
              className="group justify-start px-4 typography-labelSemiBold h-8 text-neutral-b2"
            >
              <span style={{ flex: 1 }}>{group.flow}</span>
              {enableRename &&
                iconButton(
                  `Rename flow ${group.flow}`,
                  <Pencil className="h-3 w-3" />,
                  () => renameFlowPrompt(group.flow),
                  "header",
                  "ml-2",
                )}
            </MenuHeader>
            {group.steps.map((s) => {
              const isCurrent = screen === s.id;
              const stepSnapshots = snapshotsByScreen.get(s.id) ?? [];
              const stepSelected = isCurrent && appliedSnapshotId === null;
              return (
                <Fragment key={s.id}>
                  <MenuItem
                    selected={stepSelected}
                    className="group"
                    onClick={() => {
                      if (!isCurrent) {
                        setScreen(s.id as ScreenId);
                        closeAll();
                      } else if (screenStateAdapter?.reset) {
                        // Already on this screen — clicking the parent step
                        // resets to the pristine code state (adapter.reset).
                        // Makes the parent feel like a restore point.
                        screenStateAdapter.reset();
                        closeAll();
                      } else {
                        closeAll();
                      }
                    }}
                  >
                    <MenuItemText>{s.step}</MenuItemText>
                    {iconButton(
                      `Copy export prompt for ${s.step}`,
                      <Share2 className="h-3 w-3" />,
                      () => {
                        void copyExportPrompt(group.flow, s.step);
                        closeAll();
                      },
                      "row",
                      "ml-2",
                    )}
                    {iconButton(
                      `Copy link for ${s.step}`,
                      <Link className="h-3 w-3" />,
                      () => {
                        void copyLink(s.id as ScreenId);
                        closeAll();
                      },
                    )}
                    {enableRename &&
                      iconButton(
                        `Rename step ${s.step}`,
                        <Pencil className="h-3 w-3" />,
                        () => renameStepPrompt(group.flow, s.step),
                      )}
                  </MenuItem>
                  {/* Snapshots — inline indented under their parent step. */}
                  {screenStateAdapter &&
                    stepSnapshots.map((snap) => (
                      <MenuItem
                        key={snap.id}
                        selected={appliedSnapshotId === snap.id}
                        className="group"
                        onClick={() => {
                          applySnapshot(snap);
                          closeAll();
                        }}
                      >
                        <MenuItemText>
                          <span style={{ paddingLeft: 20 }}>{snap.name}</span>
                        </MenuItemText>
                        {iconButton(
                          `Copy export prompt for ${snap.name}`,
                          <Share2 className="h-3 w-3" />,
                          () => {
                            void copyExportPrompt(group.flow, s.step, snap);
                            closeAll();
                          },
                        )}
                        {enableRename &&
                          iconButton(
                            `Rename snapshot ${snap.name}`,
                            <Pencil className="h-3 w-3" />,
                            () => renameSnapshotPrompt(snap),
                          )}
                        {iconButton(
                          `Delete snapshot ${snap.name}`,
                          <Trash2 className="h-3 w-3" />,
                          () => deleteSnapshot(snap.id),
                          "danger",
                        )}
                      </MenuItem>
                    ))}
                  {/* "+ Snapshot" — only on the current screen's step. */}
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

      {/* 2nd-level Theme submenu — same Paper-anchor + left-end pattern. */}
      <Menu
        open={themeOpen}
        anchorEl={fabMenuPaperEl ?? themeAnchor}
        onClose={() => setThemeAnchor(null)}
        placement="left-end"
        PopperProps={{ offset: 8 }}
        PopperPaperProps={{
          style: {
            width: "fit-content",
            minWidth: 0,
            maxHeight: "calc(100vh - 32px)",
            overflowY: "auto",
          },
        }}
      >
        {themeItems.map((item) => (
          <MenuItem
            key={item.value}
            selected={themeOption === item.value}
            onClick={() => {
              setThemeOption(item.value);
              closeAll();
            }}
          >
            <MenuItemText>{item.label}</MenuItemText>
          </MenuItem>
        ))}
      </Menu>

      {/* Inline name-prompt — shown for snapshot capture/rename and
          flow/step source renames. Renders above all menus (zIndex 10001).
          Click the backdrop or press Escape to cancel. */}
      {namePrompt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={namePrompt.title}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10001,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.3)",
          }}
          onClick={() => setNamePrompt(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 24,
              minWidth: 320,
              maxWidth: 480,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="typography-subtitle text-neutral-b0">
              {namePrompt.title}
            </p>
            <TextField
              label=""
              value={namePromptValue}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNamePromptValue(e.target.value)
              }
              size="large"
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Enter") confirmNamePrompt();
                if (e.key === "Escape") setNamePrompt(null);
              }}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              data-test-automation-id="fab-name-prompt-input"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outlined"
                color="neutral"
                size="medium"
                onClick={() => setNamePrompt(null)}
                data-test-automation-id="fab-name-prompt-cancel"
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                size="medium"
                onClick={confirmNamePrompt}
                data-test-automation-id="fab-name-prompt-confirm"
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
