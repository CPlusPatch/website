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

/**
 * Calls `tick` every `interval` milliseconds while `root` is on screen and
 * not paused by its <PauseButton>, and marks it `data-running` meanwhile.
 * Animations under way in it pause and resume with it.
 * Moving content needs a way to stop it, so this also shows `control`, the
 * button's hidden wrapper, and presses the button under reduced motion.
 */
export const playWhileVisible = (
    root: HTMLElement,
    control: HTMLElement | null,
    interval: number,
    tick: () => void,
) => {
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
    if (
        button &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
        setPaused(button, true);
    }

    new MutationObserver(play).observe(root, {
        attributeFilter: ["data-paused"],
    });
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        play();
    }).observe(root);
};
