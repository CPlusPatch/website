/** How far a drag on the grip must go, in px, to count as a drag and not a tap. */
const DRAG_MIN = 8;

/** Whether the sheet is open after a drag of `dy` px (down is positive) on its grip. */
export const sheetAfterDrag = (dy: number, open: boolean): boolean =>
    Math.abs(dy) < DRAG_MIN ? !open : dy < 0;
