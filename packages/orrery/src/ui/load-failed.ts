/** The text the loading state shows when the Orrery can't start. */
export const LOAD_FAILED =
    "Orbits couldn't load. Reload the page to try again.";

/** Replaces the loading state's text with `LOAD_FAILED`, and drops its bar. */
export const showLoadFailed = (root: HTMLElement): void => {
    const text = root.querySelector(".orrery__loading-text");
    if (text) text.textContent = LOAD_FAILED;

    root.querySelector(".orrery__loading-bar")?.remove();
};
