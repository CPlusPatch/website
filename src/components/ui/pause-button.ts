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
