/*
 * The actions the gallery's dialogue stories run: a page-wide easter egg
 * or two, to show what a dialogue tree's `action` can reach.
 */
import { defineDialogueActions } from "../components/blocks/message/dialogue.ts";
import { shake } from "../lib/page-effects.ts";

let overlay: HTMLElement | undefined;

const lightsOn = () => {
    const leaving = overlay;
    overlay = undefined;
    leaving
        ?.animate({ opacity: 0 }, { duration: 300, easing: "ease-out" })
        .finished.then(() => leaving.remove());
};

defineDialogueActions({
    shake,

    /** Dims the whole page, until lightsOn or a restart. */
    lightsOut: () => {
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.setAttribute("aria-hidden", "true");
            Object.assign(overlay.style, {
                position: "fixed",
                inset: "0",
                zIndex: "var(--z-destructor)",
                pointerEvents: "none",
                backgroundColor: "rgb(0 0 0 / 0.6)",
            });
            document.body.append(overlay);
            overlay.animate({ opacity: [0, 1] }, { duration: 300 });
        }
        return lightsOn;
    },

    lightsOn,
});
