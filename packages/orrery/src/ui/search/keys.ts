import type { Body } from "@cpluspatch/sim";
import { firstOf, type Place, rowIds, type StepKey, step } from "./nav.ts";

/** What the search box knows when a key is pressed. */
export type KeyState = Place & {
    bodies: readonly Body[];
    query: string;
    /** True when the right pane covers the left one. */
    narrow: boolean;
};

/** What a key does, or null when it is left to the input. */
export type KeyResult =
    | { type: "go"; place: Place }
    | { type: "pick"; id: string; andFocus: boolean }
    | { type: "add" }
    | { type: "back" }
    | { type: "none" }
    | null;

const STEP_KEYS: readonly string[] = ["ArrowDown", "ArrowUp", "Home", "End"];

/** The effect of `key` in the search box. A non-null result means the key's default is prevented. */
export const keyResult = (
    key: string,
    shiftKey: boolean,
    state: KeyState,
): KeyResult => {
    const { bodies, query, narrow, shown, pane, active } = state;
    const searching = query.trim() !== "";

    if (
        STEP_KEYS.includes(key) &&
        // In a query Home and End move the caret.
        (!searching || key === "ArrowDown" || key === "ArrowUp")
    ) {
        const ids = rowIds(bodies, query, { shown, pane });
        const id = step(ids, active, key as StepKey);
        if (id === undefined) return { type: "none" };

        const follows = pane === "left" && !searching && id;

        return {
            type: "go",
            place: { shown: follows ? id : shown, pane, active: id },
        };
    }

    if (key === "Enter") {
        if (active) return { type: "pick", id: active, andFocus: shiftKey };
        if (searching) return { type: "add" };
        if (pane === "right") {
            return { type: "pick", id: shown, andFocus: shiftKey };
        }

        return { type: "none" };
    }

    // With a query, the caret keeps Left and Right.
    if (searching) return null;

    if (key === "ArrowRight" && pane === "left") {
        const first = firstOf(bodies, shown);
        if (!first && !narrow) return { type: "none" };

        return { type: "go", place: { shown, pane: "right", active: first } };
    }

    if (key === "ArrowLeft" && pane === "right") return { type: "back" };

    return null;
};
