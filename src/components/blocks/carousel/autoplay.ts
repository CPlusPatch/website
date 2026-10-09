import type { Track } from "./track.ts";

/**
 * Rotation for a carousel with `autoplay`, by the rules in its Props.
 *
 * Its state is all attributes on `root`, so the CSS can show it:
 * data-paused is stopped (the PauseButton's own state, which it toggles),
 * and data-held is held by hover or a hidden tab.
 */
export const bindAutoplay = (
    root: HTMLElement,
    track: Track,
    {
        pause,
        timer,
        status,
    }: {
        pause: HTMLElement;
        /** Where the progress animation runs; see <CarouselPips>. */
        timer: HTMLElement;
        /** The live region announcing slide changes. */
        status: HTMLElement | null;
    },
) => {
    if (track.count < 2) {
        pause.hidden = true;
        return;
    }
    root.style.setProperty("--carousel-interval", `${root.dataset.autoplay}s`);

    const stopped = () => root.hasAttribute("data-paused");
    const stop = () => {
        pause.setAttribute("aria-pressed", "true");
        root.setAttribute("data-paused", "");
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) stop();

    // The user taking over stops rotation. The control itself is exempt, or
    // pressing it would stop rotation and then toggle it straight back on.
    const takeOver = (event: Event) => {
        if (!pause.contains(event.target as Node)) stop();
    };
    root.addEventListener("focusin", takeOver);
    root.addEventListener("pointerdown", takeOver);

    // Hovering and a hidden tab only hold rotation, keeping the current
    // slide's progress for when it resumes.
    let hovered = false;
    const hold = (hover = hovered) => {
        hovered = hover;
        root.toggleAttribute("data-held", hovered || document.hidden);
    };
    root.addEventListener("pointerenter", (event) =>
        hold(event.pointerType === "mouse"),
    );
    root.addEventListener("pointerleave", () => hold(false));
    document.addEventListener("visibilitychange", () => hold());
    // Pressing play is a request to see it move, even with the mouse still
    // over the carousel.
    pause.addEventListener("click", () => hold(false));

    // The current pip's progress bar is the timer: it fills over the
    // interval and advances when full, so pausing or holding the bar
    // (both CSS) pauses the timer with it, and they never drift apart.
    timer.addEventListener("animationend", () => {
        if (!stopped()) track.goTo((track.current + 1) % track.count);
    });

    // Announcing every rotation would talk over the rest of the page.
    const live = () =>
        status?.setAttribute("aria-live", stopped() ? "polite" : "off");
    new MutationObserver(live).observe(root, {
        attributes: true,
        attributeFilter: ["data-paused"],
    });
    live();
};
