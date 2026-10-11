import { motion } from "../../../lib/motion.ts";

/**
 * The shorts' scrolling: a feed that snaps to one short at a time, moved by
 * `goTo`, the arrows, the keys, or natively (swipe, wheel, trackpad), with
 * the current short derived from wherever it is, so they all agree. The
 * carousel's track (carousel/track.ts) is the same idea across.
 */

export interface Feed {
    readonly count: number;
    readonly current: number;
    /** Clamped to the shorts, so `current + 1` at the end is safe. */
    goTo(index: number): void;
    /**
     * Calls `listener` now, and again whenever the current short changes,
     * with the one before it (-1 the first time).
     */
    onChange(listener: (current: number, previous: number) => void): void;
    /** Says `message` to screen readers. */
    announce(message: string): void;
}

export const bindFeed = (root: HTMLElement): Feed => {
    const part = (name: string) =>
        root.querySelector(`[data-shorts-${name}]`) as HTMLElement;
    const feed = part("feed");
    const previous = part("previous");
    const next = part("next");
    const status = part("status");
    const shorts = [...feed.querySelectorAll<HTMLElement>("[data-short]")];
    const count = shorts.length;

    const clamp = (i: number) => Math.max(0, Math.min(i, count - 1));
    // Each short is the feed's height, so that is the step between them.
    // Hidden, the feed has none, so the current short stays as it was.
    const fromScroll = () =>
        feed.clientHeight
            ? clamp(Math.round(feed.scrollTop / feed.clientHeight))
            : Math.max(current, 0);

    const listeners: ((current: number, previous: number) => void)[] = [];
    let current = -1;

    const announce = (message: string) => {
        status.textContent = message;
    };

    const select = (i: number) => {
        if (i === current) return;
        const before = current;
        current = i;
        // Shorts that are off screen must not be reachable by keyboard.
        for (const [n, short] of shorts.entries()) short.inert = n !== current;
        previous.setAttribute("aria-disabled", String(current === 0));
        next.setAttribute("aria-disabled", String(current === count - 1));
        // Not on load: only a change is news.
        if (before !== -1) {
            const name = shorts[current].getAttribute("aria-label");
            announce(`Short ${current + 1} of ${count}: ${name}`);
        }
        for (const listener of listeners) listener(current, before);
    };

    const goTo = (i: number) =>
        feed.scrollTo({
            top: clamp(i) * feed.clientHeight,
            behavior: motion(),
        });

    previous.addEventListener("click", () => goTo(current - 1));
    next.addEventListener("click", () => goTo(current + 1));
    part("nav").hidden = false;

    // Makes the feed keyboard-scrollable (WCAG 2.1.1). The keys move a whole
    // short: native key scrolling nudges, and leaves snapping to sort it out.
    feed.tabIndex = 0;
    root.addEventListener("keydown", (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        // The seek bar takes the arrows for itself.
        if ((event.target as HTMLElement).matches("input")) return;
        const to = {
            ArrowDown: current + 1,
            PageDown: current + 1,
            ArrowUp: current - 1,
            PageUp: current - 1,
            Home: 0,
            End: count - 1,
        }[event.key];
        if (to === undefined) return;
        event.preventDefault();
        goTo(to);
    });

    const sync = () => select(fromScroll());
    feed.addEventListener("scroll", sync, { passive: true });
    // Snapping keeps the short aligned through a resize, but re-read it.
    new ResizeObserver(sync).observe(feed);
    sync();

    return {
        count,
        get current() {
            return current;
        },
        goTo,
        onChange(listener) {
            listeners.push(listener);
            listener(current, -1);
        },
        announce,
    };
};
