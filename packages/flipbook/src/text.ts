import type { Flipbook } from "./codec.ts";

/** Two cells a character, top and bottom, so they come out about square. */
const GLYPHS = [" ", "▄", "▀", "█"];

/**
 * A frame as block-character text, a line for every two rows of cells. A
 * cell is filled when its level is in the upper half of the flipbook's, so
 * one with more than two levels is drawn in black and white.
 */
export const toText = (
    { columns, rows, levels }: Flipbook,
    frame: Uint8Array,
): string => {
    const filled = (row: number, column: number) =>
        row < rows && frame[row * columns + column] * 2 >= levels ? 1 : 0;
    const lines: string[] = [];
    for (let row = 0; row < rows; row += 2) {
        let line = "";
        for (let column = 0; column < columns; column++) {
            line += GLYPHS[filled(row, column) * 2 + filled(row + 1, column)];
        }
        lines.push(line);
    }
    return lines.join("\n");
};
