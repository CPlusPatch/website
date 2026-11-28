/// <reference types="deno" />

import { assertEquals } from "@std/assert";
import {
    DEFAULT_LOOK,
    isDefaultLook,
    LOOK_OPTIONS,
    lookParams,
    parseLook,
} from "./look.ts";

Deno.test("DEFAULT_LOOK: the first of each list", () => {
    assertEquals(DEFAULT_LOOK, {
        theme: "default",
        scheme: "auto",
        style: "poster",
        spacing: "default",
        radius: "default",
        fontSize: "default",
    });
});

Deno.test("LOOK_OPTIONS: Mode, spacing, radius and font size are the overrides'", () => {
    assertEquals(
        LOOK_OPTIONS.scheme.map((o) => o.value),
        ["auto", "light", "dark"],
    );
    assertEquals(
        LOOK_OPTIONS.fontSize.map((o) => o.value),
        ["default", "small", "large"],
    );
});

Deno.test("isDefaultLook: false once one setting differs", () => {
    assertEquals(isDefaultLook(DEFAULT_LOOK), true);
    assertEquals(isDefaultLook({ ...DEFAULT_LOOK, radius: "round" }), false);
});

Deno.test("lookParams: none for the default look", () => {
    assertEquals(lookParams(DEFAULT_LOOK, "off"), {});
});

Deno.test("lookParams: only what differs, with font-size's own name", () => {
    assertEquals(
        lookParams(
            {
                ...DEFAULT_LOOK,
                theme: "nord",
                spacing: "compact",
                fontSize: "large",
            },
            "off",
        ),
        { theme: "nord", spacing: "compact", "font-size": "large" },
    );
});

Deno.test("lookParams: no scheme while comparing light and dark", () => {
    const look = { ...DEFAULT_LOOK, scheme: "dark", style: "mono" };

    assertEquals(lookParams(look, "schemes"), { style: "mono" });
    assertEquals(lookParams(look, "themes"), { scheme: "dark", style: "mono" });
});

Deno.test("parseLook: reads JSON text or an object", () => {
    const look = { ...DEFAULT_LOOK, theme: "nord", radius: "square" };

    assertEquals(parseLook(JSON.stringify(look)), look);
    assertEquals(parseLook(look), look);
});

Deno.test("parseLook: unknown values and keys fall back to the default", () => {
    assertEquals(
        parseLook({ theme: "nope", scheme: "dark", extra: 1, spacing: 3 }),
        { ...DEFAULT_LOOK, scheme: "dark" },
    );
});

Deno.test("parseLook: bad input is the default look", () => {
    assertEquals(parseLook("{oops"), DEFAULT_LOOK);
    assertEquals(parseLook(null), DEFAULT_LOOK);
    assertEquals(parseLook("42"), DEFAULT_LOOK);
});
