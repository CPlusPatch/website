/**
 * <Navbar>: exposes the menu checkbox's state as aria-expanded. The checkbox
 * keeps the menu working without JS; script only reflects it, since
 * aria-expanded can't follow :checked from CSS.
 *
 * Root: `.navbar`, containing `[data-navbar-toggle]` (the checkbox) and
 * `[data-navbar-menu]` (the menu, given an id if it has none).
 */
import { behaviour } from "./behaviour.ts";

let nextId = 0;

const navbar = behaviour(".navbar", (root, signal) => {
    const toggle = root.querySelector<HTMLInputElement>("[data-navbar-toggle]");
    const menu = root.querySelector<HTMLElement>("[data-navbar-menu]");
    if (!toggle || !menu) return;

    const hadId = menu.id !== "";
    menu.id ||= `navbar-menu-${nextId++}`;
    toggle.setAttribute("aria-controls", menu.id);

    const sync = () =>
        toggle.setAttribute("aria-expanded", String(toggle.checked));
    toggle.addEventListener("change", sync, { signal });
    sync();

    return () => {
        toggle.removeAttribute("aria-controls");
        toggle.removeAttribute("aria-expanded");
        if (!hadId) menu.removeAttribute("id");
    };
});

export const initNavbar = navbar.init;
export const initNavbars = navbar.initAll;
