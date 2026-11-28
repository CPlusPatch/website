/**
 * <SegmentedControl>: marks which way a pick moved, so the CSS can stretch
 * the accent bar toward the new option.
 *
 * Root: `.segmented`, a fieldset of radios. A change sets `data-direction`
 * on it to `forward` (the new option is later in the row) or `back`. On
 * bind, an overflowing control scrolls its checked option into view.
 */
import { behaviour } from "./behaviour.ts";

/** Which way the pick moved, or nothing when there was no earlier pick or it didn't move. */
export const pickDirection = (
    from: number,
    to: number,
): "forward" | "back" | undefined => {
    if (from < 0 || to < 0 || from === to) return undefined;

    return to > from ? "forward" : "back";
};

const segmentedControl = behaviour<HTMLElement>(
    ".segmented",
    (root, signal) => {
        const radios = () => [
            ...root.querySelectorAll<HTMLInputElement>("input[type=radio]"),
        ];
        let index = radios().findIndex((radio) => radio.checked);

        // Not scrollIntoView, which would scroll the page too.
        const scroller = root.querySelector<HTMLElement>(".segmented__options");
        const option = radios()[index]?.closest("label");
        if (scroller && option) {
            const end = option.offsetLeft + option.offsetWidth;
            if (end > scroller.clientWidth) {
                scroller.scrollLeft = end - scroller.clientWidth;
            }
        }

        root.addEventListener(
            "change",
            () => {
                const next = radios().findIndex((radio) => radio.checked);
                if (next < 0) return;

                const direction = pickDirection(index, next);
                if (direction) root.dataset.direction = direction;
                index = next;
            },
            { signal },
        );
    },
);

export const initSegmentedControl = segmentedControl.init;
export const initSegmentedControls = segmentedControl.initAll;
