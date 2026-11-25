/// <reference types="deno" />

import { assertEquals } from "@std/assert";
import type { Appearance } from "../appearance.ts";
import { LAYERS, mapKeys } from "./index.ts";

const MADE_UP: Appearance = {
    map: "surface",
    glow: true,
    atmosphere: {
        top: 100,
        day: "#fff",
        twilight: "#000",
        rim: 1,
        haze: 0,
    },
    clouds: { map: "clouds" },
    nightSide: { map: "lights" },
    rings: { map: "strip", inner: 1, outer: 2 },
};

// The builders need WebGL objects, so the tests look at which layers ask for what.
const asking = (appearance: Appearance): string[] =>
    LAYERS.filter(({ field }) => appearance[field] !== undefined).map(
        ({ field }) => field,
    );

Deno.test("the layers run in the registry order", () => {
    assertEquals(
        LAYERS.map(({ field }) => field),
        ["map", "glow", "atmosphere", "clouds", "rings", "nightSide"],
    );
});

Deno.test("a made-up body's appearance turns on its layers, with no preset", () => {
    assertEquals(
        asking({ atmosphere: MADE_UP.atmosphere, rings: MADE_UP.rings }),
        ["atmosphere", "rings"],
    );
    assertEquals(asking({}), []);
});

Deno.test("an appearance lists the maps its layers load", () => {
    assertEquals(mapKeys(MADE_UP), ["surface", "clouds", "strip", "lights"]);
    assertEquals(mapKeys({ glow: true, atmosphere: MADE_UP.atmosphere }), []);
    assertEquals(mapKeys({}), []);
});

Deno.test("only glow has no builder, since the entry reads it", () => {
    assertEquals(
        LAYERS.filter(({ build }) => !build).map(({ field }) => field),
        ["glow"],
    );
});
