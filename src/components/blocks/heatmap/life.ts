/** The top level, which live cells take. */
const ALIVE = 4;

/** Generations kept to spot a board that has settled into a loop. */
const MEMORY = 12;

/**
 * Conway's Game of Life on a heatmap's cells, on a board that wraps at its
 * edges. Live cells take the top level; dead ones fade a level each
 * generation, leaving trails. It starts from `start`, its busiest cells
 * alive, and when it dies out or settles into a short loop, it starts again
 * from a random soup.
 *
 * Returns a function that steps it on and returns the levels to show.
 */
export const life = (
    columns: number,
    rows: number,
    start: ArrayLike<number>,
) => {
    const levels = Uint8Array.from(start);
    let alive = levels.map((level) => (level >= ALIVE - 1 ? 1 : 0));
    const seen: string[] = [];

    const generation = () => {
        const next = alive.map((cell, i) => {
            const row = Math.floor(i / columns);
            const column = i % columns;
            let neighbours = 0;
            for (const dr of [-1, 0, 1]) {
                for (const dc of [-1, 0, 1]) {
                    if (!dr && !dc) continue;
                    const r = (row + dr + rows) % rows;
                    const c = (column + dc + columns) % columns;
                    neighbours += alive[r * columns + c];
                }
            }
            return neighbours === 3 || (neighbours === 2 && cell) ? 1 : 0;
        });

        const state = next.join("");
        if (!next.includes(1) || seen.includes(state)) {
            seen.length = 0;
            return next.map(() => (Math.random() < 0.35 ? 1 : 0));
        }
        seen.push(state);
        if (seen.length > MEMORY) seen.shift();
        return next;
    };

    return () => {
        alive = generation();
        for (const [i, cell] of alive.entries()) {
            levels[i] = cell ? ALIVE : Math.max(0, levels[i] - 1);
        }
        return levels;
    };
};
