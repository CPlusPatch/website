import { stepRate } from "../clock.ts";
import type { World } from "../world.ts";

const IGNORED = "input, select, textarea, button, [contenteditable], dialog";

/** Binds Space, `[`, `]` and R to the clock of `world`. Returns a function that unbinds them. */
export const bindTimeShortcuts = (world: World): (() => void) => {
    const onKeyDown = (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.isComposing) return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;

        // A held Space would toggle the clock many times a second.
        if (event.repeat) return;

        // A focused button would also click on Space.
        const target = event.target;
        if (target instanceof Element && target.closest(IGNORED)) return;

        const { clock } = world;

        if (event.key === " ") {
            world.setClock({ paused: !clock.paused });
        } else if (event.key === "[") {
            world.setClock({ rate: stepRate(clock.rate, -1) });
        } else if (event.key === "]") {
            world.setClock({ rate: stepRate(clock.rate, 1) });
        } else if (event.key === "r" || event.key === "R") {
            world.setClock({ rate: -clock.rate });
        } else {
            return;
        }

        event.preventDefault();
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
};
