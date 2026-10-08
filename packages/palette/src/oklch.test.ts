/// <reference types="deno" />
import { assert, assertEquals, assertMatch } from "@std/assert";
import { hex, inGamut, maxChroma } from "./oklch.ts";

Deno.test("hex maps the lightness extremes to black and white", () => {
    assertEquals(hex(0, 0, 0), "#000000");
    assertEquals(hex(1, 0, 0), "#ffffff");
});

Deno.test("hex clips out-of-gamut colours instead of overflowing", () => {
    assertMatch(hex(0.7, 0.4, 150), /^#[0-9a-f]{6}$/);
});

Deno.test("maxChroma lands on the sRGB gamut boundary", () => {
    for (const [l, h] of [
        [0.45, 3.8],
        [0.78, 84],
        [0.72, 303.7],
    ]) {
        const c = maxChroma(l, h);
        assert(inGamut(l, c, h), `L=${l} H=${h} C=${c} in gamut`);
        assert(!inGamut(l, c + 0.005, h), `L=${l} H=${h} past boundary`);
    }
});
