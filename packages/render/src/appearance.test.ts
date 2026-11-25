/// <reference types="deno" />

import { PRESETS } from "@cpluspatch/catalog";
import type { Body } from "@cpluspatch/sim";
import { assert, assertEquals } from "@std/assert";
import {
    type Appearance,
    appearanceOf,
    validateAppearance,
} from "./appearance.ts";
import { mapKeys } from "./layers/index.ts";
import { hasMap } from "./maps.ts";

const check = (input: unknown): { value: unknown; errors: string[] } => {
    const errors: string[] = [];
    const value = validateAppearance("earth.appearance", input, errors);

    return { value, errors };
};

Deno.test("valid colours are kept, in either case", () => {
    for (const color of ["#abc", "#AABBCC", "#ffd700"]) {
        const input = { color };
        const { value, errors } = check(input);

        assertEquals(errors, [], color);
        assertEquals(value, input);
    }
});

Deno.test("an appearance with no colour is kept, unknown keys included", () => {
    const input = { shininess: 1 };
    const { value, errors } = check(input);

    assertEquals(errors, []);
    assertEquals(value, input);
});

Deno.test("a bad colour names the path", () => {
    for (const color of ["red", "#abcd", "#12345g", ""]) {
        const { errors } = check({ color });

        assertEquals(errors, [
            `earth.appearance.color: must be a #rgb or #rrggbb colour (got ${JSON.stringify(color)})`,
        ]);
    }
});

Deno.test("a colour that isn't a string is an error", () => {
    assertEquals(check({ color: 5 }).errors, [
        "earth.appearance.color: must be a string (got 5)",
    ]);
    assertEquals(check({ color: null }).errors, [
        "earth.appearance.color: must be a string (got null)",
    ]);
});

Deno.test("appearanceOf is empty when the body has none", () => {
    const body = { id: "sun", tags: [] } as unknown as Body;

    assertEquals(appearanceOf(body), {});
    assertEquals(appearanceOf({ ...body, appearance: { color: "#fff" } }), {
        color: "#fff",
    });
});

Deno.test("every catalog preset's appearance is valid", () => {
    for (const [id, preset] of Object.entries(PRESETS)) {
        if (preset.appearance === undefined) continue;

        const errors: string[] = [];
        validateAppearance(`${id}.appearance`, preset.appearance, errors);

        assertEquals(errors, [], id);
    }
});

const GOOD = {
    top: 100,
    day: "#4f9bff",
    twilight: "#ff7a3d",
    rim: 1,
    haze: 0.06,
};

Deno.test("good values for each layer's field are kept", () => {
    const input = {
        map: "earth",
        glow: true,
        atmosphere: GOOD,
        clouds: { map: "earth-clouds" },
        nightSide: { map: "earth-night" },
        rings: { map: "saturn-ring", inner: 1, outer: 2 },
    };
    const { value, errors } = check(input);

    assertEquals(errors, []);
    assertEquals(value, input);
});

Deno.test("a map key that isn't a known map is valid", () => {
    assertEquals(
        check({ map: "nowhere", clouds: { map: "nowhere" } }).errors,
        [],
    );
});

Deno.test("a field of the wrong type is an error", () => {
    assertEquals(check({ map: 5 }).errors, [
        "earth.appearance.map: must be a string (got 5)",
    ]);
    assertEquals(check({ glow: "yes" }).errors, [
        'earth.appearance.glow: must be true or false (got "yes")',
    ]);
    assertEquals(check({ atmosphere: 1 }).errors, [
        "earth.appearance.atmosphere: must be an object (got 1)",
    ]);
    assertEquals(check({ clouds: { map: null } }).errors, [
        "earth.appearance.clouds.map: must be a string (got null)",
    ]);
    assertEquals(check({ nightSide: "x" }).errors, [
        'earth.appearance.nightSide: must be an object (got "x")',
    ]);
    assertEquals(check({ rings: null }).errors, [
        "earth.appearance.rings: must be an object (got null)",
    ]);
    assertEquals(check({ atmosphere: { ...GOOD, top: "1", day: 2 } }).errors, [
        'earth.appearance.atmosphere.top: must be a number above 0 (got "1")',
        "earth.appearance.atmosphere.day: must be a string (got 2)",
    ]);
});

Deno.test("an atmosphere's numbers and colours are checked", () => {
    assertEquals(check({ atmosphere: { ...GOOD, rim: 2 } }).errors, [
        "earth.appearance.atmosphere.rim: must be a number from 0 to 1 (got 2)",
    ]);
    assertEquals(check({ atmosphere: { ...GOOD, haze: -0.1 } }).errors, [
        "earth.appearance.atmosphere.haze: must be a number from 0 to 1 (got -0.1)",
    ]);
    assertEquals(check({ atmosphere: { ...GOOD, top: 0 } }).errors, [
        "earth.appearance.atmosphere.top: must be a number above 0 (got 0)",
    ]);
    assertEquals(
        check({ atmosphere: { ...GOOD, twilight: "orange" } }).errors,
        [
            'earth.appearance.atmosphere.twilight: must be a #rgb or #rrggbb colour (got "orange")',
        ],
    );
});

Deno.test("rings need 0 < inner < outer", () => {
    const rings = { map: "r", inner: 5, outer: 9 };

    assertEquals(check({ rings: { ...rings, inner: 0 } }).errors, [
        "earth.appearance.rings.inner: must be a number above 0 (got 0)",
    ]);
    assertEquals(check({ rings: { ...rings, outer: "9" } }).errors, [
        'earth.appearance.rings.outer: must be a number above 0 (got "9")',
    ]);
    assertEquals(check({ rings: { ...rings, outer: 5 } }).errors, [
        "earth.appearance.rings.outer: must be more than inner (got 5)",
    ]);
});

Deno.test("a star gets glow from its tag, and its own false wins", () => {
    const star = { id: "sun", tags: ["star"] } as unknown as Body;

    assertEquals(appearanceOf(star), { glow: true });
    assertEquals(appearanceOf({ ...star, appearance: { glow: false } }), {
        glow: false,
    });
    assertEquals(appearanceOf({ ...star, appearance: { color: "#fff" } }), {
        glow: true,
        color: "#fff",
    });
});

Deno.test("a body's own fields win over the tag's", () => {
    const star = {
        id: "sun",
        tags: ["star"],
        appearance: { glow: false, map: "sun" },
    } as unknown as Body;

    assertEquals(appearanceOf(star), { glow: false, map: "sun" });
});

Deno.test("every catalog preset's maps exist", () => {
    for (const [id, preset] of Object.entries(PRESETS)) {
        for (const key of mapKeys((preset.appearance ?? {}) as Appearance))
            assert(hasMap(key), `${id}: ${key}`);
    }
});
