/**
 * <PauseButton>: pause/play for moving content (WCAG 2.2.2).
 *
 * Root: `[data-pause-target]`, the button. Its value is a selector for the
 * ancestor to pause. Clicking toggles `aria-pressed` on the button and
 * `data-paused` on that ancestor, and the animated component styles its own
 * paused state from that attribute.
 */
import { reducedMotion } from "../lib/motion.ts";
import { behaviour } from "./behaviour.ts";

/**
 * Presses a <PauseButton> or releases it, and pauses or resumes its target
 * to match, as clicking it does. For scripts that pause on the reader's
 * behalf, like under reduced motion.
 */
export const setPaused = (button: HTMLElement, paused: boolean) => {
    button.setAttribute("aria-pressed", String(paused));
    button
        .closest(button.dataset.pauseTarget ?? "")
        ?.toggleAttribute("data-paused", paused);
};

const pauseButton = behaviour("[data-pause-target]", (button, signal) => {
    button.addEventListener(
        "click",
        () => setPaused(button, button.getAttribute("aria-pressed") !== "true"),
        { signal },
    );
});

export const initPauseButton = pauseButton.init;
export const initPauseButtons = pauseButton.initAll;

/**
 * Calls `tick` every `interval` milliseconds while `root` is on screen and
 * not paused by its <PauseButton>, and marks it `data-running` meanwhile.
 * Animations under way in it pause and resume with it.
 * Moving content needs a way to stop it, so this also shows `control`, the
 * button's hidden wrapper, and presses the button under reduced motion,
 * unless `pauseForReducedMotion` is false, for content that updates without
 * moving.
 *
 * Returns a function that stops all of that: the ticking, the observers and
 * the markers, and hides `control` again.
 */
export const playWhileVisible = (
    root: HTMLElement,
    control: HTMLElement | null,
    interval: number,
    tick: () => void,
    { pauseForReducedMotion = true } = {},
): (() => void) => {
    let visible = false;
    let timer = 0;
    const play = () => {
        const playing = visible && !root.hasAttribute("data-paused");
        root.toggleAttribute("data-running", playing);
        if (playing && !timer) {
            timer = window.setInterval(tick, interval);
        } else if (!playing && timer) {
            clearInterval(timer);
            timer = 0;
        }
        // Script animations already under way stop and go with it
        for (const animation of root.getAnimations({ subtree: true })) {
            if (animation.playState === "finished") continue;
            if (playing) animation.play();
            else animation.pause();
        }
    };

    const button = control?.querySelector<HTMLElement>("[data-pause-target]");
    if (control) control.hidden = false;
    if (button && pauseForReducedMotion && reducedMotion()) {
        setPaused(button, true);
    }

    const mutations = new MutationObserver(play);
    mutations.observe(root, { attributeFilter: ["data-paused"] });
    const intersections = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        play();
    });
    intersections.observe(root);

    return () => {
        mutations.disconnect();
        intersections.disconnect();
        clearInterval(timer);
        timer = 0;
        root.removeAttribute("data-running");
        if (control) control.hidden = true;
    };
};
