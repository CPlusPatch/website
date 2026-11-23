/**
 * @module
 * The loading state that covers the Orrery until its sky and maps are in.
 */

import { reducedMotion } from "@cpluspatch/ui/lib/motion.ts";

/** The ms the loading state fades out for. Keep in step with `styles/loading.css`. */
const FADE_MS = 200;

/** The loading state of the Orrery. */
export type Loading = {
    /** Shows `done` of `total` files and fills the bar to `fill`, from 0 to 1. */
    progress: (done: number, total: number, fill: number) => void;
    /** Fades the loading state out and removes it. Does nothing the second time. */
    reveal: () => void;
    /** Removes the loading state at once. */
    destroy: () => void;
};

/** The stage shown once the code is in. */
// The trailing space parts it from the count, as Astro drops the one in the markup.
const STAGE = "Loading sky and maps, ";

/** The loading state in `root`, or one that does nothing if the page has none. */
export const createLoading = (root: HTMLElement): Loading => {
    const element = root.querySelector<HTMLElement>(".orrery__loading");
    if (!element)
        return { progress: () => {}, reveal: () => {}, destroy: () => {} };

    const stage = element.querySelector(".orrery__loading-stage");
    const count = element.querySelector(".orrery__loading-count");
    const bar = element.querySelector<HTMLProgressElement>(
        ".orrery__loading-bar",
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    let revealed = false;

    return {
        progress: (done, total, fill) => {
            // Set only on change, so the live region doesn't repeat it.
            if (stage && stage.textContent !== STAGE) stage.textContent = STAGE;
            if (count) count.textContent = `${done} of ${total}`;
            // A map that starts later adds to the total, which would move the bar back.
            if (bar) bar.value = Math.max(bar.value, fill);
        },
        reveal: () => {
            if (revealed) return;

            revealed = true;
            if (reducedMotion()) {
                element.remove();
                return;
            }

            element.classList.add("orrery__loading--done");
            timer = setTimeout(() => element.remove(), FADE_MS);
        },
        destroy: () => {
            revealed = true;
            clearTimeout(timer);
            element.remove();
        },
    };
};
