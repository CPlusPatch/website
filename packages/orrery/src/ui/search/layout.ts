/** The gap in px between the panel and the edges of the root. */
export const MARGIN = 8;

type Edges = { left: number; top: number; right: number; bottom: number };

/**
 * The panel's offset in px from the top left of the root, in the root's own space.
 * It sits under the top bar, or under the toggle without one, and stays inside the root.
 */
export const panelOffset = (
    host: Edges,
    toggle: Edges,
    barBottom: number | undefined,
    width: number,
): { top: number; left: number } => {
    const leftEdge = Math.max(
        MARGIN,
        Math.min(toggle.left, host.right - width - MARGIN),
    );

    return {
        top: (barBottom ?? toggle.bottom) - host.top,
        left: leftEdge - host.left,
    };
};
