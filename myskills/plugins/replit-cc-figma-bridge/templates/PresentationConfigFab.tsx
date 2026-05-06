import { useRef, useState, type ComponentType, Fragment } from "react";
import {
  IconButton,
  Menu as MenuRaw,
  MenuHeader as MenuHeaderRaw,
  MenuItem as MenuItemRaw,
  MenuItemText as MenuItemTextRaw,
  MenuDivider as MenuDividerRaw,
} from "@ringcentral/spring-ui";
import { SettingsMd } from "@ringcentral/spring-icon";
import { usePresentationConfig, type ThemeOption } from "./PresentationConfigContext";
import { SCREENS, groupScreensByFlow, type ScreenId } from "../screens";

// Spring UI 1.9.x + React 19: cast Menu primitives to ComponentType<any> to
// satisfy stricter children/intrinsic-attribute typing. Do not remove these
// casts unless you've confirmed the Spring UI types have been updated.
const Menu = MenuRaw as ComponentType<any>;
const MenuHeader = MenuHeaderRaw as ComponentType<any>;
const MenuItem = MenuItemRaw as ComponentType<any>;
const MenuItemText = MenuItemTextRaw as ComponentType<any>;
const MenuDivider = MenuDividerRaw as ComponentType<any>;

export function PresentationConfigFab() {
  const fabRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const { themeOption, setThemeOption, screen, setScreen } =
    usePresentationConfig();

  const handleClose = () => setOpen(false);

  const themeItems: { label: string; value: ThemeOption }[] = [
    { label: "Light", value: "light" },
    { label: "Dark", value: "dark" },
    { label: "High Contrast", value: "highContrast" },
  ];

  // Flows are derived from `SCREENS` in order of first appearance.
  // To add a screen: append to SCREENS in `screens.ts` — no edits here.
  const flowGroups = groupScreensByFlow(SCREENS);

  return (
    <>
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
        onClose={handleClose}
        placement="left"
        PopperProps={{ offset: 8 }}
      >
        {flowGroups.map((group, idx) => (
          <Fragment key={group.flow}>
            {idx > 0 && <MenuDivider />}
            <MenuHeader
              divider={false}
              className="justify-start px-4 typography-labelSemiBold h-8 text-neutral-b2"
            >
              {group.flow}
            </MenuHeader>
            {group.steps.map((s) => (
              <MenuItem
                key={s.id}
                selected={screen === s.id}
                onClick={() => {
                  setScreen(s.id as ScreenId);
                  handleClose();
                }}
              >
                <MenuItemText>{s.step}</MenuItemText>
              </MenuItem>
            ))}
          </Fragment>
        ))}

        <MenuDivider />
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
      </Menu>
    </>
  );
}
