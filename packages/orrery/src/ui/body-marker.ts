import { ROLE_ICONS, type RoleKey, roleOf, styleOf } from "@cpluspatch/render";
import type { Body } from "@cpluspatch/sim";

/** The SVG of a spacecraft role's icon, drawn in the text colour. */
export const roleMarker = (role: RoleKey): string =>
    `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="${ROLE_ICONS[role]}"/></svg>`;

/** A small SVG for a body, drawn in the text colour. A body with no icon shows its role's. */
export const bodyMarker = (body: Body): string => {
    const { icon } = styleOf(body);

    return icon === null
        ? roleMarker(roleOf(body))
        : `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">${icon}</svg>`;
};
