/**
 * @module
 * The bare mode, which hides the interface to leave the view.
 */

import type { View } from "@cpluspatch/render";
import { bareAnnouncement } from "../announce.ts";

/** The class on the root while the interface is hidden. */
const BARE_CLASS = "orrery--bare";

/** The bare mode of `root`. */
export type Bare = {
    /** Hides the interface for `true`, or shows it. Does nothing if it already is. */
    set: (bare: boolean) => void;
    /** Hides the interface, or shows it if it's hidden. */
    toggle: () => void;
    /** Whether the interface is hidden. */
    is: () => boolean;
};

/**
 * The bare mode of `root`, told to the current `view`, if there is one, and to `announce`.
 * `focusCanvas` takes the focus off a control that is about to be hidden.
 */
export const createBare = (
    root: HTMLElement,
    view: () => Pick<View, "bare"> | null,
    focusCanvas: () => void,
    announce: (text: string) => void,
): Bare => {
    const is = () => root.classList.contains(BARE_CLASS);

    const set = (bare: boolean) => {
        if (is() === bare) return;

        // Focus on a hidden control would fall to the body.
        if (bare && document.activeElement?.closest(".orrery__panel")) {
            // A focus ring around the whole view would spoil it.
            focusCanvas();
        }

        root.classList.toggle(BARE_CLASS, bare);
        view()?.bare(bare);
        announce(bareAnnouncement(bare));
    };

    return { set, toggle: () => set(!is()), is };
};
