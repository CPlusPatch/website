/*
 * The actions the gallery's dialogue stories run: a page-wide easter egg
 * or two, to show what a dialogue tree's `action` can reach.
 */
import { defineDialogueActions } from "../components/blocks/message/dialogue.ts";

const reducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let overlay: HTMLElement | undefined;

const lightsOn = () => {
    const leaving = overlay;
    overlay = undefined;
    leaving
        ?.animate({ opacity: 0 }, { duration: 300, easing: "ease-out" })
        .finished.then(() => leaving.remove());
};

defineDialogueActions({
    /**
     * Rattles the whole page. Up and down, as the page already scrolls that
     * way: sideways would flash a horizontal scrollbar. With reduced motion,
     * the words say it alone.
     */
    quake: async () => {
        if (reducedMotion()) return;
        await document.body.animate(
            [0, -6, 6, -4, 4, -2, 0].map((y) => ({ translate: `0 ${y}px` })),
            { duration: 500, easing: "ease-out" },
        ).finished;
    },

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
