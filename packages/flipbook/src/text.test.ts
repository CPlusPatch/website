/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import type { Flipbook } from "./codec.ts";
import { toText } from "./text.ts";

const book = (columns: number, rows: number, levels = 2): Flipbook => ({
    columns,
    rows,
    fps: 15,
    levels,
    frames: [],
});

Deno.test("each pair of rows becomes a line of half blocks", () => {
    // Top row: on, off, on, off. Bottom row: on, on, off, off.
    const frame = Uint8Array.from([1, 0, 1, 0, 1, 1, 0, 0]);
    assertEquals(toText(book(4, 2), frame), "█▄▀ ");
});

Deno.test("an odd last row is drawn as top halves alone", () => {
    // Rows: off off / on on / off on.
    const frame = Uint8Array.from([0, 0, 1, 1, 0, 1]);
    assertEquals(toText(book(2, 3), frame), "▄▄\n ▀");
});

Deno.test("with more levels, the upper half are filled", () => {
    // Of five levels, 3 and 4 are filled; 0 to 2 are not.
    const frame = Uint8Array.from([2, 3, 4, 0]);
    assertEquals(toText(book(4, 1, 5), frame), " ▀▀ ");
});
