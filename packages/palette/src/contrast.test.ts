/// <reference types="deno" />
import { assert, assertEquals } from "@std/assert";
import { contrast, solveLightness } from "./contrast.ts";

Deno.test("contrast spans 1:1 to 21:1 and is symmetric", () => {
    assertEquals(contrast("#777777", "#777777"), 1);
    assertEquals(contrast("#000000", "#ffffff"), 21);
    assertEquals(
        contrast("#98194b", "#f2f5f3"),
        contrast("#f2f5f3", "#98194b"),
    );
});

Deno.test("solveLightness clears the target after rounding to hex", () => {
    for (const [bg, darker] of [
        ["#f2f5f3", true],
        ["#0e0e0e", false],
    ] as const) {
        for (const target of [2.2, 3, 4.5]) {
            const ratio = contrast(
                solveLightness(target, bg, 0.01, 152, darker),
                bg,
            );
            assert(ratio >= target, `${ratio} >= ${target} on ${bg}`);
            assert(
                ratio < target + 0.1,
                `${ratio} close to ${target} on ${bg}`,
            );
        }
    }
});
