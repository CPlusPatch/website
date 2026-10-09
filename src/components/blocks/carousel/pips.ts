import { motion, type Track } from "./track.ts";

/**
 * Fills a <CarouselPips> row with one pip per slide. Built here rather than
 * in the markup: the slide count is only known once the slot has rendered,
 * and without JS they would do nothing.
 */
export const bindPips = (row: HTMLElement, track: Track) => {
    const pips = Array.from({ length: track.count }, (_, i) => {
        const pip = document.createElement("button");
        pip.type = "button";
        pip.className = "carousel-pips__pip";
        pip.ariaLabel = `Slide ${i + 1}`;
        pip.addEventListener("click", () => track.goTo(i));
        row.append(pip);
        return pip;
    });

    // Past what fits, the row scrolls (only itself, never the page) to keep
    // the current pip centred.
    const reveal = () => {
        const from = row.getBoundingClientRect();
        const to = pips[track.current].getBoundingClientRect();
        row.scrollTo({
            left:
                row.scrollLeft +
                (to.left - from.left) -
                (row.clientWidth - to.width) / 2,
            behavior: motion(),
        });
    };

    // It fades at an end only while pips are hidden past it. scrollLeft runs
    // negative in RTL, so its size is the distance from the start.
    const edges = () => {
        const at = Math.abs(row.scrollLeft);
        const max = row.scrollWidth - row.clientWidth;
        row.toggleAttribute("data-fade-start", at > 1);
        row.toggleAttribute("data-fade-end", at < max - 1);
    };
    row.addEventListener("scroll", edges, { passive: true });

    new ResizeObserver(() => {
        reveal();
        edges();
    }).observe(row);

    track.onChange((current) => {
        pips.forEach((pip, i) => {
            pip.setAttribute("aria-current", String(i === current));
        });
        reveal();
    });
};
