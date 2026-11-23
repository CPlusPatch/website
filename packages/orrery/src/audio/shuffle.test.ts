/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { nextRound } from "./shuffle.ts";

// A small linear congruential generator, so the tests are repeatable.
const seeded = (seed: number): (() => number) => {
    let state = seed;

    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;

        return state / 4294967296;
    };
};

Deno.test("a round plays every track once", () => {
    const order = nextRound(8, seeded(1));

    assertEquals(
        order.toSorted((a, b) => a - b),
        [0, 1, 2, 3, 4, 5, 6, 7],
    );
});

Deno.test("a new round doesn't start with the track that just ended", () => {
    for (let seed = 1; seed <= 200; seed++) {
        const last = seed % 8;
        const order = nextRound(8, seeded(seed), last);

        assertEquals(order.length, 8);
        assertEquals(order[0] === last, false);
        assertEquals(new Set(order).size, 8);
    }
});

Deno.test("different seeds give different orders", () => {
    const orders = new Set(
        [1, 2, 3, 4, 5].map((seed) => nextRound(8, seeded(seed)).join()),
    );

    assertEquals(orders.size > 1, true);
});

Deno.test("one track repeats, as there's nothing else to play", () => {
    assertEquals(nextRound(1, seeded(1), 0), [0]);
});

Deno.test("no tracks give an empty round", () => {
    assertEquals(nextRound(0, seeded(1)), []);
});
