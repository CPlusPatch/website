import type { BodyKind } from "@cpluspatch/orbit";

const PATHS: Record<BodyKind, string> = {
    star: '<circle cx="8" cy="8" r="3.5" fill="currentColor"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    planet: '<circle cx="8" cy="8" r="4.5" fill="currentColor"/><ellipse cx="8" cy="8" rx="7.3" ry="2.4" fill="none" stroke="currentColor" stroke-width="1.2" transform="rotate(-20 8 8)"/>',
    dwarf: '<circle cx="8" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/>',
    moon: '<path d="M10.5 2.2A6 6 0 1 0 13.8 10 4.7 4.7 0 0 1 10.5 2.2z" fill="currentColor"/>',
    spacecraft:
        '<g fill="currentColor"><rect x="6.5" y="6" width="3" height="4"/><rect x="1" y="6.5" width="4.5" height="3"/><rect x="10.5" y="6.5" width="4.5" height="3"/></g><path d="M8 6V3" stroke="currentColor" stroke-width="1.2"/>',
};

/** A small SVG for a kind of body, drawn in the text colour. */
export const bodyMarker = (kind: BodyKind): string =>
    `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">${PATHS[kind]}</svg>`;
