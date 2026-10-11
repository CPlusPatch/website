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
