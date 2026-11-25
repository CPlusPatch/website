/// <reference types="deno" />

import type { Body } from "@cpluspatch/sim";
import { assertEquals } from "@std/assert";
import { appearanceOf, validateAppearance } from "./appearance.ts";

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
    const input = { clouds: 1 };
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
    const body = { id: "sun" } as Body;

    assertEquals(appearanceOf(body), {});
    assertEquals(appearanceOf({ ...body, appearance: { color: "#fff" } }), {
        color: "#fff",
    });
});
