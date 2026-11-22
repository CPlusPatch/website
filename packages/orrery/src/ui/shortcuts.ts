import { stepRate } from "../clock.ts";
import type { World } from "../world.ts";

const TEXT = "input, select, textarea, [contenteditable], dialog";

/** What the shortcuts call that isn't the world's. */
export type ShortcutActions = {
    /** Closes the keys card. Returns whether it was open. */
    closeKeys: () => boolean;
    goLive: () => void;
    toggleDate: () => void;
};

/**
 * Binds Space, `[`, `]`, R, L and T to the clock of `world`, and F and Escape to its selection.
 * Escape closes the keys card first. Returns a function that unbinds them.
 */
export const bindShortcuts = (
    world: World,
    { closeKeys, goLive, toggleDate }: ShortcutActions,
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
                if (world.selected === null) return;

                world.select(null);
            }
        } else if (event.key === "f" || event.key === "F") {
            if (world.selected === null) return;

            world.focus(world.selected);
        } else if (event.key === " ") {
            world.setClock({ paused: !clock.paused });
        } else if (event.key === "[") {
            world.setClock({ rate: stepRate(clock.rate, -1) });
        } else if (event.key === "]") {
            world.setClock({ rate: stepRate(clock.rate, 1) });
        } else if (event.key === "r" || event.key === "R") {
            world.setClock({ rate: -clock.rate });
        } else if (event.key === "l" || event.key === "L") {
            goLive();
        } else if (event.key === "t" || event.key === "T") {
            toggleDate();
        } else {
            return;
        }

        event.preventDefault();
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
};
