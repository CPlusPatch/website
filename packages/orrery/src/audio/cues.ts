/**
 * @module
 * The sound cues the interface fires, and the bus that routes them to a player.
 */

/** The interface sounds. */
export type Cue =
    | "select"
    | "play"
    | "pause"
    | "rate"
    | "edit"
    | "add"
    | "remove"
    | "load"
    | "tick";

/** Cues closer together than this, in ms, collapse into the first. */
export const CUE_GAP_MS = 150;

/** The least time between two ticks, in ms. */
export const TICK_GAP_MS = 60;

/** Whether a cue at `now` plays, given when the last non-tick and tick cues played. */
export const shouldPlay = (
    name: Cue,
    now: number,
    last: { cue: number; tick: number },
): boolean =>
    name === "tick"
        ? now - last.tick >= TICK_GAP_MS
        : now - last.cue >= CUE_GAP_MS;

let player: ((name: Cue) => void) | null = null;
const last = { cue: Number.NEGATIVE_INFINITY, tick: Number.NEGATIVE_INFINITY };

const reset = () => {
    last.cue = Number.NEGATIVE_INFINITY;
    last.tick = Number.NEGATIVE_INFINITY;
};

/** Sets the function that plays cues, or `null` to silence them. */
export const setCuePlayer = (next: ((name: Cue) => void) | null): void => {
    player = next;
    // A new player shouldn't inherit the gaps of the old one.
    reset();
};

/** Silences the cues, but only if `expected` is still the player. */
export const clearCuePlayer = (expected: (name: Cue) => void): void => {
    if (player === expected) setCuePlayer(null);
};

/** Fires a cue. Nothing happens without a player, or if the cue comes too soon. */
export const cue = (name: Cue): void => {
    if (!player) return;

    const now = performance.now();
    if (!shouldPlay(name, now, last)) return;

    last[name === "tick" ? "tick" : "cue"] = now;
    player(name);
};
