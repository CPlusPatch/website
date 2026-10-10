/// <reference types="deno" />
import { assertEquals, assertThrows } from "@std/assert";
import { decode, encode, type Flipbook } from "./codec.ts";

const book = (frames: number[][], columns = 4, rows = 2): Flipbook => ({
    columns,
    rows,
    fps: 12,
    levels: 5,
    frames: frames.map((frame) => Uint8Array.from(frame)),
});

Deno.test("a flipbook survives encoding and decoding", () => {
    const original = book([
        [0, 0, 0, 0, 0, 0, 0, 0],
        [4, 4, 3, 2, 1, 0, 0, 4],
        [1, 2, 3, 4, 4, 3, 2, 1],
    ]);
    assertEquals(decode(encode(original)), original);
});

Deno.test("runs longer than a byte holds split, and stay in their frame", () => {
    const cells = 100;
    const original = book(
        [new Array(cells).fill(3), new Array(cells).fill(0)],
        10,
        10,
    );
    const bytes = encode(original);
    // Five levels take 3 bits, leaving runs of up to 32: 4 a frame.
    assertEquals(bytes.length, 6 + 2 * 4);
    assertEquals(decode(bytes), original);
});

Deno.test("two levels take one bit, leaving runs of up to 128", () => {
    const original: Flipbook = {
        ...book([new Array(100).fill(1), new Array(100).fill(0)], 10, 10),
        levels: 2,
    };
    const bytes = encode(original);
    assertEquals(bytes.length, 6 + 2 * 1);
    assertEquals(decode(bytes), original);
});

Deno.test("a frame of the wrong size is refused", () => {
    assertThrows(() => encode(book([[0, 0, 0]])), RangeError);
});

Deno.test("more levels than leave room for a run are refused", () => {
    assertThrows(
        () => encode({ ...book([[0, 0, 0, 0, 0, 0, 0, 0]]), levels: 129 }),
        RangeError,
    );
});
