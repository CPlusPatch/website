/**
 * <DisplayMenu>: keeps the menu's choices across pages (see bindDisplayMenu
 * in lib/display.ts) and gives controls with a `data-shortcut` an Alt+Shift
 * key (see bindShortcuts in lib/shortcuts.ts).
 *
 * Root: `.display-menu`. Controls to keep are `[data-persist]` wrappers
 * around inputs; theme pickers are `[data-theme-select]`.
 */
import { bindDisplayMenu } from "../lib/display.ts";
import { bindShortcuts } from "../lib/shortcuts.ts";
import { behaviour } from "./behaviour.ts";

const displayMenu = behaviour(".display-menu", (menu) => {
    const unbindMenu = bindDisplayMenu(menu);
    const unbindShortcuts = bindShortcuts(menu);
    return () => {
        unbindMenu();
        unbindShortcuts();
    };
});

export const initDisplayMenu = displayMenu.init;
export const initDisplayMenus = displayMenu.initAll;
