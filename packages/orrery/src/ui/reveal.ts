/**
 * @module
 * The reveal that ends the loading state once the first view is ready or the wait runs out.
 */

import type { View } from "@cpluspatch/render";
import type { Loading } from "./loading.ts";

/** The reveal of the loading state. */
export type Reveal = {
    /** Whether the loading state is gone. */
    revealed: () => boolean;
    /** Starts the wait and reveals when `first` is ready or `afterMs` have passed. */
    start: (first: View, afterMs: number) => void;
    /** Reveals when `built` is ready, if it's still the current view. */
    whenReady: (built: View) => void;
    /** Ends the loading state now. Does nothing the second time, or after `destroy`. */
    reveal: () => void;
    /** Cancels the wait, and makes every later reveal do nothing. */
    destroy: () => void;
};

/** The reveal for `loading`, which also calls `onReveal` and shows the view from `current`. */
export const createReveal = (
    loading: Pick<Loading, "reveal">,
    current: () => View | null,
    onReveal: () => void,
): Reveal => {
    let revealed = false;
    let destroyed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const reveal = () => {
        if (revealed || destroyed) return;

        revealed = true;
        clearTimeout(timer);
        onReveal();
        loading.reveal();
        current()?.reveal();
    };

    // A destroyed view's ready resolves too, so only the current one reveals.
    const whenReady = (built: View) => {
        void built.ready.then(() => {
            if (current() === built) reveal();
        });
    };

    return {
        revealed: () => revealed,
        start: (first, afterMs) => {
            timer = setTimeout(reveal, afterMs);
            whenReady(first);
        },
        whenReady,
        reveal,
        destroy: () => {
            destroyed = true;
            clearTimeout(timer);
        },
    };
};
