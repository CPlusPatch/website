/** How far a drag on the grip must go, in px, to count as a drag and not a tap. */
const DRAG_MIN = 8;

/** Whether the sheet is open after a drag of `dy` px (down is positive) on its grip. */
export const sheetAfterDrag = (dy: number, open: boolean): boolean =>
    Math.abs(dy) < DRAG_MIN ? !open : dy < 0;

/** How far the stack of shown cards reaches up from the panel's bottom, in px. */
export const sheetSpace = (
    bottom: number,
    cards: readonly { top: number; height: number }[],
): number => {
    const tops = cards
        .filter((card) => card.height > 0)
        .map((card) => card.top);

    return tops.length === 0 ? 0 : Math.max(0, bottom - Math.min(...tops));
};
