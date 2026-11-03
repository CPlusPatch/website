/**
 * A <Progress> is drawn from --progress-value and announced from
 * aria-valuenow, so the two are only ever set together: by the component
 * when it renders, and by setProgress() after that.
 */

/** `value` clamped to 0 to `max`, and the fraction of the bar it fills. */
export const measure = (value: number, max: number) => {
    const now = Math.min(max, Math.max(0, value));
    return { now, fraction: max > 0 ? now / max : 0 };
};

/**
 * Moves a <Progress> to `value`, out of the `max` it was rendered with.
 * A decorative bar has nothing to announce, so only its fill moves.
 */
export const setProgress = (bar: HTMLElement, value: number) => {
    const { now, fraction } = measure(value, Number(bar.dataset.max));
    bar.style.setProperty("--progress-value", String(fraction));
    if (bar.role === "progressbar") {
        bar.setAttribute("aria-valuenow", String(now));
    }
};
