/**
 * The reader's motion preference, for scripts. CSS has its own media query;
 * this is for motion that scripts start, like autoplay and scrolling.
 */

/** Whether the reader has asked for less motion. */
export const reducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Smooth scrolling, unless the reader prefers reduced motion. */
export const motion = (): ScrollBehavior =>
    reducedMotion() ? "auto" : "smooth";

let offscreen: IntersectionObserver | undefined;

/**
 * Marks each element `data-offscreen` while it is out of view, so its CSS
 * can pause looping animations there. WebKit keeps running them off screen,
 * and scrolling anywhere on the page gets slower for it.
 */
export const markOffscreen = (elements: Iterable<Element>) => {
    offscreen ??= new IntersectionObserver((entries) => {
        for (const entry of entries) {
            entry.target.toggleAttribute(
                "data-offscreen",
                !entry.isIntersecting,
            );
        }
    });
    for (const element of elements) offscreen.observe(element);
};
