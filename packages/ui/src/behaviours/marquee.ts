/**
 * <Marquee>: marks it `data-offscreen` while out of view, so its CSS can
 * pause the loop there, and takes the duplicate groups' focusable content
 * out of the tab order.
 *
 * Root: `.marquee`, whose `.marquee__group[aria-hidden="true"]` children are
 * the duplicates. They are aria-hidden but deliberately not inert (inert
 * would stop them reacting to hover).
 */
import { markOffscreen } from "../lib/motion.ts";
import { behaviour } from "./behaviour.ts";

const marquee = behaviour(".marquee", (root) => {
    const stopWatching = markOffscreen([root]);

    const removed: [el: HTMLElement, tabindex: string | null][] = [];
    for (const el of root.querySelectorAll<HTMLElement>(
        '.marquee__group[aria-hidden="true"] :is(a[href], button, input, select, textarea, summary, [tabindex])',
    )) {
        removed.push([el, el.getAttribute("tabindex")]);
        el.tabIndex = -1;
    }

    return () => {
        stopWatching();
        for (const [el, tabindex] of removed) {
            if (tabindex === null) el.removeAttribute("tabindex");
            else el.setAttribute("tabindex", tabindex);
        }
    };
});

export const initMarquee = marquee.init;
export const initMarquees = marquee.initAll;
