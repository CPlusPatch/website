/// <reference types="deno" />
import { builtInScenarios, PRESETS } from "@cpluspatch/catalog";
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import type { Appearance } from "../appearance.ts";
import {
    type Atmosphere,
    EXAGGERATION,
    MAX_TOP,
    MIN_TOP,
    shellFor,
} from "./atmospheres.ts";

const atmosphere = (top: number): Atmosphere => ({
    top,
    day: "#4f9bff",
    twilight: "#ff7a3d",
    rim: 1,
    haze: 0.06,
});

const atmosphereOf = (id: string): Atmosphere | undefined =>
    (PRESETS[id]?.appearance as Appearance | undefined)?.atmosphere;

Deno.test("a body without an atmosphere has no shell", () => {
    assertEquals(shellFor(atmosphereOf("moon"), 1737), null);
    assertEquals(shellFor(undefined, 1000), null);
});

Deno.test("the shell's top is the exaggerated height over the radius", () => {
    const shell = shellFor(atmosphere(100), 6371);

    assertAlmostEquals(shell?.top ?? 0, 1 + (EXAGGERATION * 100) / 6371, 1e-9);
});

Deno.test("a shell is never thinner or thicker than the limits", () => {
    assertEquals(shellFor(atmosphereOf("jupiter"), 69911)?.top, MIN_TOP);
    assertEquals(shellFor(atmosphereOf("titan"), 2575)?.top, MAX_TOP);
});

Deno.test("colours are 6-digit hex, and rim and haze are between 0 and 1", () => {
    for (const id of Object.keys(PRESETS)) {
        const atmosphere = atmosphereOf(id);
        if (!atmosphere) continue;

        assert(/^#[0-9a-f]{6}$/.test(atmosphere.day), `${id} day`);
        assert(/^#[0-9a-f]{6}$/.test(atmosphere.twilight), `${id} twilight`);
        assert(atmosphere.rim >= 0 && atmosphere.rim <= 1, `${id} rim`);
        assert(atmosphere.haze >= 0 && atmosphere.haze <= 1, `${id} haze`);
    }
});

Deno.test("every atmosphere belongs to a built-in body", () => {
    const models = new Set<string | undefined>(
        builtInScenarios.flatMap(({ bodies }) =>
            bodies.map(({ preset }) => preset),
        ),
    );

    for (const id of Object.keys(PRESETS)) {
        if (atmosphereOf(id)) assert(models.has(id), id);
    }
});
