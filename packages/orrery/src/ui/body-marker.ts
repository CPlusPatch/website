import type { Body, BodyKind } from "@cpluspatch/sim";
import { ROLE_ICONS, type RoleKey, roleOf } from "../view/bodies/role-icons.ts";
import { colorOf } from "../view/theme.ts";

const PATHS: Record<Exclude<BodyKind, "spacecraft">, string> = {
    star: '<circle cx="8" cy="8" r="3.5" fill="currentColor"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    planet: '<circle cx="8" cy="8" r="4.5" fill="currentColor"/><ellipse cx="8" cy="8" rx="7.3" ry="2.4" fill="none" stroke="currentColor" stroke-width="1.2" transform="rotate(-20 8 8)"/>',
    dwarf: '<circle cx="8" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/>',
    moon: '<path d="M10.5 2.2A6 6 0 1 0 13.8 10 4.7 4.7 0 0 1 10.5 2.2z" fill="currentColor"/>',
    asteroid:
        '<path d="M4 4 9.5 1.5 14 5 13 9l1.5 3-6.5 2.5L2 12 1.5 7z" fill="currentColor"/>',
    comet: '<path d="M3.2 8 15 1 8 12.8z" fill="currentColor" fill-opacity="0.55"/><circle cx="5" cy="11" r="3.5" fill="currentColor"/>',
};

/** The SVG of a spacecraft role's icon, drawn in the text colour. */
export const roleMarker = (role: RoleKey): string =>
    `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="${ROLE_ICONS[role]}"/></svg>`;

/** A small SVG for a body, drawn in the text colour. Spacecraft show their role's icon. */
export const bodyMarker = (body: Body): string =>
    body.kind === "spacecraft"
        ? roleMarker(roleOf(body))
        : `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">${PATHS[body.kind]}</svg>`;

/** Draws a body's marker into `element`, in the body's colour. `parent` is the body it orbits. */
export const showBodyMarker = (
    element: HTMLElement,
    body: Body,
    parent: Body | undefined,
): void => {
    element.innerHTML = bodyMarker(body);
    element.style.color = colorOf(body, parent);
};
