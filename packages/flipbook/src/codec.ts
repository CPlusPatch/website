/**
 * A flipbook: frames of a grid of cells, each cell a level from 0 to
 * `levels - 1`, like pixels in a few shades.
 *
 * Stored as a 6-byte header (columns and rows as little-endian u16, then fps
 * and levels as u8), followed by each frame, run-length encoded: one byte per
 * run, its level in the top bits (as few as the levels need) and its length
 * less one in the rest. Two levels leave 7 bits, for runs of up to 128.
 * Runs never cross into the next frame, so a frame is the runs that fill
 * its columns × rows cells.
 */
export interface Flipbook {
    columns: number;
    rows: number;
    fps: number;
    levels: number;
    /** One level per cell, row by row. */
    frames: Uint8Array[];
}

const HEADER = 6;
const MAX_LEVELS = 128;

/** Bits for the run's length, after those for its level. */
const runBits = (levels: number) =>
    8 - Math.max(1, Math.ceil(Math.log2(levels)));

export const encode = ({
    columns,
    rows,
    fps,
    levels,
    frames,
}: Flipbook): Uint8Array => {
    if (levels > MAX_LEVELS) {
        throw new RangeError(
            `At most ${MAX_LEVELS} levels fit, not ${levels}.`,
        );
    }
    const bits = runBits(levels);
    const maxRun = 1 << bits;
    const cells = columns * rows;
    const runs: number[] = [];
    for (const frame of frames) {
        if (frame.length !== cells) {
            throw new RangeError(
                `A frame has ${frame.length} cells, not ${columns} × ${rows}.`,
            );
        }
        for (let i = 0; i < cells; ) {
            const level = frame[i];
            let run = 1;
            while (run < maxRun && frame[i + run] === level) run++;
            runs.push((level << bits) | (run - 1));
            i += run;
        }
    }

    const bytes = new Uint8Array(HEADER + runs.length);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, columns, true);
    view.setUint16(2, rows, true);
    view.setUint8(4, fps);
    view.setUint8(5, levels);
    bytes.set(runs, HEADER);
    return bytes;
};

export const decode = (bytes: Uint8Array): Flipbook => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const columns = view.getUint16(0, true);
    const rows = view.getUint16(2, true);
    const levels = view.getUint8(5);
    const bits = runBits(levels);
    const cells = columns * rows;

    const frames: Uint8Array[] = [];
    let frame = new Uint8Array(cells);
    let filled = 0;
    for (let i = HEADER; i < bytes.length; i++) {
        const run = (bytes[i] & ((1 << bits) - 1)) + 1;
        frame.fill(bytes[i] >> bits, filled, filled + run);
        filled += run;
        if (filled >= cells) {
            frames.push(frame);
            frame = new Uint8Array(cells);
            filled = 0;
        }
    }

    return { columns, rows, fps: view.getUint8(4), levels, frames };
};
