/** The top level, which live cells take. */
const ALIVE = 4;

/** Generations kept to spot a board that has settled into a loop. */
const MEMORY = 12;

/** Generations over which the activity is averaged to spot a calm board. */
const WINDOW = 20;

/** Cells changing a generation, on average, below which a board is calm. */
const CALM = 30;

/**
 * Cells that differ from the one above them, below which a board has gone
 * flat. On a board only 7 rows tall, soups tend to collapse into full-height
 * bars that drift sideways, which is one-dimensional and dull to watch.
 */
const FLAT = 40;

/**
 * A soup for a 52 by 7 board, picked from thousands for how long it stays
 * lively: about 200 generations (40 seconds at the heatmap's pace) before it
 * calms, where most soups settle in under 50.
 */
const SEED = [
    ".......OOOOO.OO...O.O...OO.O.O.O...OO..O.O.OO..O....",
    "OOOO...O..O.O.O....OO....OOO.O...OO.O..OO...O.OO...O",
    ".O....OO..OO..OO.O...O..OOOO........O.OOOOOOO.O.O...",
    "OOO.O....O.O.OOO.OOO.O.O..O..OO....OOOO.O....OO.OOO.",
    "OO...OO....O....OO.O..O......O....OOOO.O...O...OOOOO",
    ".OOO...O..OO..O..O..OOO.OO.O.O.O.OO.O........OOO..OO",
    "....OO.O..O.O..O.O.....O..O.O...O.OOO.OO..O.O.O.OOOO",
];

/**
 * Conway's Game of Life on a heatmap's cells, on a board that wraps at its
 * edges. Live cells take the top level; dead ones fade a level each
 * generation, leaving trails. It starts from `start`'s levels, but with SEED
 * alive if the board is the size it was found for, else its busiest cells.
 * When it dies out or settles into a short loop, it starts again from a
 * random soup. So does a board that has calmed, or gone flat.
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
    if (rows === SEED.length && columns === SEED[0].length) {
        alive = Uint8Array.from(SEED.join(""), (char) =>
            char === "O" ? 1 : 0,
        );
    }
    const seen: string[] = [];
    /** Cells changed in each recent generation. */
    const changes: number[] = [];

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

        changes.push(next.reduce((sum, cell, i) => sum + (cell ^ alive[i]), 0));
        if (changes.length > WINDOW) changes.shift();
        const calm =
            changes.length === WINDOW &&
            changes.reduce((sum, n) => sum + n, 0) / WINDOW < CALM;
        const flat =
            next.reduce(
                (sum, cell, i) =>
                    sum + (cell ^ next[(i + columns) % next.length]),
                0,
            ) < FLAT;

        const state = next.join("");
        if (!next.includes(1) || seen.includes(state) || calm || flat) {
            seen.length = 0;
            changes.length = 0;
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
