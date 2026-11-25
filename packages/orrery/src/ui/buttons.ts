const SVG = (body: string) =>
    `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">${body}</svg>`;

export const FOCUS_ICON = SVG(
    '<g fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="4"/><path d="M8 0.5V3.5M8 12.5V15.5M0.5 8H3.5M12.5 8H15.5"/></g>',
);
