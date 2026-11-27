/*
 * A frame can't size itself to its content, so this grows one to its page's
 * height. Used by the Display menu's Compare row (compare.ts) and the bench's
 * stage (bench.svelte).
 */

import { STORY_NAME } from "./story.ts";

/** Past this, a story sized to the viewport would grow its frame forever. */
export const MAX_HEIGHT = 2400;

/** A link to a story or a group on a group's page: `#<group>/<story>[/<combo>]`, `#<group>`. */
const NAME = STORY_NAME.source.slice(1, -1);
const STORY_HASH = new RegExp(`^#${NAME}(?:/${NAME}){0,2}$`);

type FitOptions = {
    /** Takes a story link's hash; true if it handled it, so the frame stays put. */
    onHashLink?: (hash: string) => boolean;
};

/** Keeps a frame as tall as its page's main, and its links out of it. */
export const fit = (
    frame: HTMLIFrameElement,
    { onHashLink }: FitOptions = {},
): void => {
    let observer: ResizeObserver | undefined;
    const setup = () => {
        observer?.disconnect();
        const doc = frame.contentDocument;
        const main = doc?.querySelector("main");
        if (!doc || !main) return;

        // Open alone, the section's own links: in the page, not the frame.
        for (const link of doc.querySelectorAll("a[href]")) {
            const href = link.getAttribute("href") ?? "";
            if (onHashLink && STORY_HASH.test(href)) {
                link.addEventListener("click", (event) => {
                    if (onHashLink(href)) event.preventDefault();
                });
            } else if (!href.startsWith("#")) {
                // A link within the page (a tab, a footnote) stays in the frame.
                link.setAttribute("target", "_top");
            }
        }

        observer = new ResizeObserver(() => {
            const height = Math.min(Math.ceil(main.offsetHeight), MAX_HEIGHT);
            if (Math.abs(frame.offsetHeight - height) > 1) {
                frame.style.height = `${height}px`;
            }
        });
        observer.observe(main);
    };

    frame.addEventListener("load", setup);
    // A frame that loaded before this ran has no load event left to come.
    if (frame.contentDocument?.readyState === "complete") setup();
};
