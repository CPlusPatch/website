import { type AUnit, aUnit, stepRate, type Units } from "@cpluspatch/render";
import { readouts } from "@cpluspatch/sim";
import { cue } from "../audio/cues.ts";
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
    /** Turns the chase camera on, or off if it's on. */
    toggleChase: () => void;
    /** Hides the interface, or shows it if it's hidden. */
    toggleBare: () => void;
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
 * U switches the distance `units`, C chases the focus, F1 hides the interface and `/` opens the
 * search.
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
        toggleChase,
        toggleBare,
        toggleDate,
    }: ShortcutActions,
): (() => void) => {
    let spaceOnButton = false;
    // Read when focus lands, since Chromium makes a mouse-focused button :focus-visible on keydown.
    let keyboardFocus =
        document.activeElement?.matches(":focus-visible") ?? false;

    const onFocusIn = (event: FocusEvent) => {
        keyboardFocus =
            event.target instanceof Element &&
            event.target.matches(":focus-visible");
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.isComposing) return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;

        // A held Space would toggle the clock many times a second.
        if (event.repeat) return;

        const target = event.target;
        const element = target instanceof Element ? target : null;

        if (element?.closest(TEXT)) return;
        // A keyboard-focused button clicks on Space. After a mouse click it doesn't get the key.
        const button = element?.closest("button") ?? null;
        if (event.key === " " && button && keyboardFocus) return;

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
            spaceOnButton = button !== null;
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
        } else if (event.key === "c" || event.key === "C") {
            toggleChase();
        } else if (event.key === "F1") {
            toggleBare();
        } else if (event.key === "/") {
            openSearch();
        } else {
            return;
        }

        event.preventDefault();
    };

    // Firefox clicks a button on Space's keyup, even if the keydown was cancelled.
    const onKeyUp = (event: KeyboardEvent) => {
        if (event.key !== " " || !spaceOnButton) return;

        spaceOnButton = false;
        event.preventDefault();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("focusin", onFocusIn);

    return () => {
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("keyup", onKeyUp);
        document.removeEventListener("focusin", onFocusIn);
    };
};
