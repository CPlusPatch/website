/**
 * <Dropdown>: closes its panel once an in-page link inside it has been
 * followed, so a menu of anchors doesn't sit over the section it jumped to.
 * Opening, Esc, outside clicks and focus are the native popover's.
 *
 * Root: `.dropdown`, containing a `.dropdown__panel` popover.
 */
import { behaviour } from "./behaviour.ts";

const dropdown = behaviour(".dropdown", (root, signal) => {
    root.addEventListener(
        "click",
        (event) => {
            const link = (event.target as Element).closest?.('a[href^="#"]');
            const panel = link?.closest<HTMLElement>(
                ".dropdown__panel:popover-open",
            );
            panel?.hidePopover();
        },
        { signal },
    );
});

export const initDropdown = dropdown.init;
export const initDropdowns = dropdown.initAll;
