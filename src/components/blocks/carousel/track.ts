/**
 * The carousel's scrolling: a scroll-snapping track of equal-width slides,
 * moved by `goTo` or natively (swipe, trackpad, keys), with one current
 * slide derived from wherever it is. The controls only build on this.
 */

/** Smooth, unless the user prefers reduced motion. */
export const motion = (): ScrollBehavior =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth";

export interface Track {
    readonly count: number;
    /** The slide showing, or the one a `goTo` is scrolling to. */
    readonly current: number;
    /** Clamped to the slides, so `current + 1` at the end is safe. */
    goTo(index: number): void;
    /** Calls `listener` now, and again whenever the current slide changes. */
    onChange(listener: (index: number) => void): void;
}

export const bindTrack = (track: HTMLElement): Track => {
    const slides = Array.from(track.children) as HTMLElement[];
    const count = slides.length;

    slides.forEach((slide, i) => {
        slide.setAttribute("role", "group");
        slide.setAttribute("aria-roledescription", "slide");
        slide.setAttribute("aria-label", `${i + 1} of ${count}`);
    });

    // Makes the track keyboard-scrollable (WCAG 2.1.1).
    track.tabIndex = 0;

    const rtl = getComputedStyle(track).direction === "rtl";
    const clamp = (i: number) => Math.max(0, Math.min(i, count - 1));
    // Distance between snap points. Slides are all one width, so the first
    // pair stands for every pair, and this stays right across resizes.
    const step = () =>
        count > 1
            ? Math.abs(slides[1].offsetLeft - slides[0].offsetLeft)
            : track.clientWidth;
    // Nearest snap point wins, so mid-swipe there is always exactly one
    // current slide.
    const fromScroll = () =>
        clamp(Math.round(Math.abs(track.scrollLeft) / step()));

    const listeners: ((index: number) => void)[] = [];
    let current = fromScroll();
    // Set while a `goTo` scrolls, so the slides it passes on the way are not
    // taken for the current one. Browsers without scrollend could never
    // clear it, so there it is never set.
    let scrolling = false;

    const set = (i: number) => {
        if (i === current) return;
        current = i;
        update();
    };
    const update = () => {
        // Slides that are off-screen must not be reachable by keyboard.
        slides.forEach((slide, n) => {
            slide.inert = n !== current;
        });
        for (const listener of listeners) listener(current);
    };

    const goTo = (i: number) => {
        scrolling = "onscrollend" in window;
        set(clamp(i));
        track.scrollTo({
            left: current * step() * (rtl ? -1 : 1),
            behavior: motion(),
        });
    };

    // Arrow keys, Home and End move a whole slide. Native key scrolling
    // nudges by a fixed amount and leaves mandatory snapping to sort it out,
    // which is unreliable at either end.
    track.addEventListener("keydown", (event) => {
        if (event.target !== track) return;
        const to = {
            [rtl ? "ArrowLeft" : "ArrowRight"]: current + 1,
            [rtl ? "ArrowRight" : "ArrowLeft"]: current - 1,
            Home: 0,
            End: count - 1,
        }[event.key];
        if (to === undefined) return;
        event.preventDefault();
        goTo(to);
    });

    const sync = () => {
        if (!scrolling) set(fromScroll());
    };
    track.addEventListener("scroll", sync, { passive: true });
    track.addEventListener("scrollend", () => {
        scrolling = false;
        sync();
    });
    // Snapping keeps the slide aligned through a resize, but the step
    // changes, so re-read where the track is.
    new ResizeObserver(sync).observe(track);
    update();

    return {
        count,
        get current() {
            return current;
        },
        goTo,
        onChange(listener) {
            listeners.push(listener);
            listener(current);
        },
    };
};
