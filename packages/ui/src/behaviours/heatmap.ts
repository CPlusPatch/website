/**
 * <Heatmap> with `life`: plays the Game of Life on its cells.
 *
 * Root: `.heatmap[data-life]`. Needs the `--columns` custom property on the
 * root, `.heatmap__grid > .heatmap__cell` cells carrying `data-level`, and
 * optionally a `[data-heatmap-pause]` wrapper (hidden until script runs)
 * around a <PauseButton>.
 */
import { behaviour } from "./behaviour.ts";
import { life } from "./heatmap/life.ts";
import { playWhileVisible } from "./pause-button.ts";

/** Generations a second: slow enough to follow a glider. */
const FPS = 5;

/**
 * Plays the Game of Life on a <Heatmap>'s cells, a generation at a time
 * while it is in view and not paused. Only the cells that change are
 * touched. Cleanup stops it and puts the cells back as they were rendered.
 */
const heatmap = behaviour(".heatmap[data-life]", (root) => {
    const cells = [
        ...root.querySelectorAll<HTMLElement>(
            ".heatmap__grid > .heatmap__cell",
        ),
    ];
    const initial = cells.map((cell) => cell.dataset.level);
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

    const stop = playWhileVisible(
        root,
        root.querySelector("[data-heatmap-pause]"),
        1000 / FPS,
        () => draw(next()),
    );
    return () => {
        stop();
        for (const [i, cell] of cells.entries()) {
            if (initial[i] === undefined) delete cell.dataset.level;
            else cell.dataset.level = initial[i];
        }
    };
});

export const initHeatmap = heatmap.init;
export const initHeatmaps = heatmap.initAll;
