/**
 * @module
 * Undo and redo through the document's history.
 */

import { historyAnnouncement } from "../announce.ts";

/** The undo and redo of the document store. */
export type Edits = {
    canUndo: boolean;
    canRedo: boolean;
    /** Returns what the edit was, or `null` if there's none or its restore failed. */
    undo: () => string | null;
    /** Returns what the edit was, or `null` if there's none or its restore failed. */
    redo: () => string | null;
};

/** Steps `store` back or forward, after `closeForms`, and says what happened. */
export const travel = (
    store: Edits,
    kind: "undo" | "redo",
    closeForms: () => void,
    announce: (text: string) => void,
): void => {
    const able = kind === "undo" ? store.canUndo : store.canRedo;
    closeForms();

    const label = kind === "undo" ? store.undo() : store.redo();
    // A restore that failed to draw shows its own notice.
    if (able && label === null) return;

    announce(historyAnnouncement(kind, label));
};
