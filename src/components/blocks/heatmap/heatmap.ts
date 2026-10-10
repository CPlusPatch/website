import { setPaused } from "../../ui/pause-button.ts";
import { life } from "./life.ts";

/** Generations a second: slow enough to follow a glider. */
const FPS = 5;

/**
 * Plays the Game of Life on a <Heatmap>'s cells, a generation at a time
 * while it is in view and not paused. Only the cells that change are
 * touched.
 */
export const bindHeatmap = (root: HTMLElement) => {
    const cells = [
        ...root.querySelectorAll<HTMLElement>(
            ".heatmap__grid > .heatmap__cell",
        ),
    ];
    const shown = cells.map((cell) => Number(cell.dataset.level ?? 0));
    const columns = Number(root.style.getPropertyValue("--columns"));
    const next = life(columns, cells.length / columns, shown);

    const draw = (frame: Uint8Array) => {
        for (const [i, cell] of cells.entries()) {
            const level = frame[i];
            if (level === shown[i]) continue;
            shown[i] = level;
            if (level) cell.dataset.level = String(level);
            else delete cell.dataset.level;
        }
    };

    let visible = false;
    let timer = 0;
    const playing = () => visible && !root.hasAttribute("data-paused");
    const play = () => {
        if (playing() && !timer) {
            timer = window.setInterval(() => draw(next()), 1000 / FPS);
        } else if (!playing() && timer) {
            clearInterval(timer);
            timer = 0;
        }
    };

    // Moving content needs a way to stop it, and reduced motion starts there.
    const pause = root.querySelector<HTMLElement>("[data-heatmap-pause]");
    const button = pause?.querySelector<HTMLElement>("[data-pause-target]");
    if (pause) pause.hidden = false;
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
