import { cue } from "../audio/cues.ts";
import { stepRate } from "../clock.ts";
import { type AUnit, aUnit } from "../editing.ts";
import { readouts } from "../readouts.ts";
import type { Units } from "../units.ts";
import type { World } from "../world.ts";

const TEXT = "input, select, textarea, [contenteditable], dialog";

/** What the shortcuts call that isn't the world's. */
export type ShortcutActions = {
    /** Closes the keys card. Returns whether it was open. */
    closeKeys: () => boolean;
    /** Clears the selected satellite. Returns whether there was one. */
    clearSatellite: () => boolean;
    /** Focuses the selected satellite. Returns whether there was one. */
    focusSatellite: () => boolean;
    goLive: () => void;
    openSearch: () => void;
    toggleDate: () => void;
};

/** The unit the card shows for the selected body, or AU when it shows none. */
const shownUnit = (world: World): AUnit => {
    const id = world.selected;
    const current = id
        ? readouts(world.scenario, id, world.states(), world.clock.t)
        : null;

    // From AU, so the first U picks km.
    return current ? aUnit(current.periapsisAltitude) : "AU";
};

/**
 * Binds Space, `[`, `]`, R, L and T to the clock of `world`, and F and Escape to its selection,
 * or to the selected satellite when no body is selected.
 * U switches the distance `units`, and `/` opens the search.
 * Escape closes the keys card first. Returns a function that unbinds them.
 */
export const bindShortcuts = (
    world: World,
    units: Units,
    {
        closeKeys,
        clearSatellite,
        focusSatellite,
        goLive,
        openSearch,
        toggleDate,
    }: ShortcutActions,
): (() => void) => {
    const onKeyDown = (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.isComposing) return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;

        // A held Space would toggle the clock many times a second.
        if (event.repeat) return;

        const target = event.target;
        const element = target instanceof Element ? target : null;

        if (element?.closest(TEXT)) return;
        // A focused button would also click on Space.
        if (event.key === " " && element?.closest("button")) return;

        const { clock } = world;
        const rate = (next: number) => {
            if (next !== clock.rate) cue("rate");
            world.setClock({ rate: next });
        };

        if (event.key === "Escape") {
            // Esc closes an open menu first. Manual popovers, like the
            // scanlines layer, stay open and don't count.
            if (
                document.querySelector(
                    '[popover]:not([popover="manual"]):popover-open',
                )
            ) {
                return;
            }

            if (!closeKeys()) {
                if (world.selected !== null) world.select(null);
                else if (!clearSatellite()) return;
            }
        } else if (event.key === "f" || event.key === "F") {
            if (world.selected !== null) world.focus(world.selected);
            else if (!focusSatellite()) return;
        } else if (event.key === " ") {
            cue(clock.paused ? "play" : "pause");
            world.setClock({ paused: !clock.paused });
        } else if (event.key === "[") {
            rate(stepRate(clock.rate, -1));
        } else if (event.key === "]") {
            rate(stepRate(clock.rate, 1));
        } else if (event.key === "r" || event.key === "R") {
            rate(-clock.rate);
        } else if (event.key === "l" || event.key === "L") {
            goLive();
        } else if (event.key === "t" || event.key === "T") {
            toggleDate();
        } else if (event.key === "u" || event.key === "U") {
            units.toggle(shownUnit(world));
        } else if (event.key === "/") {
            openSearch();
        } else {
            return;
        }

        event.preventDefault();
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
};
