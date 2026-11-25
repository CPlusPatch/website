/// <reference types="deno" />
import { assertEquals, assertStrictEquals } from "@std/assert";
import { roleOf } from "./bodies/role-icons.ts";
import { FALLBACK, styleOf, TAG_STYLES } from "./tags.ts";

Deno.test("a body takes the style of its first tag that has one", () => {
    const style = styleOf({ tags: ["custom", "moon", "planet"] });

    assertStrictEquals(style, TAG_STYLES.moon);
});

Deno.test("a body with no known tag takes the fallback style", () => {
    const style = styleOf({ tags: ["custom", "toString"] });

    assertStrictEquals(style, FALLBACK);
    assertEquals(style.label, "Body");
    assertEquals(style.color, "var(--orrery-muted)");
});

Deno.test("every tag in the table styles a body with that tag", () => {
    for (const tag of Object.keys(TAG_STYLES)) {
        assertStrictEquals(styleOf({ tags: [tag] }), TAG_STYLES[tag]);
    }
});

// Pinned to the per-kind tables the tag table replaced, so a lost value fails here.
Deno.test("each kind tag keeps the look and behaviour it had as a kind", () => {
    const pick = (tag: string): unknown[] => {
        const s = TAG_STYLES[tag];
        if (!s) throw new Error(`No style for ${tag}.`);

        return [
            s.color,
            s.shape,
            s.markerPx,
            s.labelTier,
            s.iconMarker,
            s.needsLabel,
            s.dimOrbit,
            s.reach,
            s.opening,
            s.framed,
            s.nests,
            s.sized,
            s.canParent,
            s.group,
        ];
    };

    const muted = "var(--orrery-muted)";
    const dim = "var(--orrery-dim)";
    const text = "var(--orrery-text)";
    const signal = "var(--orrery-signal)";

    assertEquals(pick("star"), [
        signal,
        "disc",
        12,
        2,
        false,
        false,
        false,
        true,
        false,
        true,
        true,
        true,
        true,
        "Stars",
    ]);
    assertEquals(pick("planet"), [
        text,
        "disc",
        8,
        1,
        false,
        false,
        false,
        true,
        true,
        true,
        true,
        true,
        true,
        "Planets",
    ]);
    assertEquals(pick("dwarf"), [
        muted,
        "ring",
        7,
        0,
        false,
        false,
        true,
        false,
        false,
        true,
        true,
        true,
        true,
        "Dwarf planets",
    ]);
    assertEquals(pick("moon"), [
        muted,
        "diamond",
        9,
        0,
        false,
        true,
        false,
        false,
        false,
        true,
        true,
        true,
        false,
        "Moons",
    ]);
    assertEquals(pick("asteroid"), [
        dim,
        "triangle",
        8,
        0,
        true,
        false,
        true,
        false,
        false,
        true,
        true,
        true,
        true,
        "Small bodies",
    ]);
    assertEquals(pick("comet"), [
        dim,
        "teardrop",
        11,
        0,
        true,
        false,
        true,
        false,
        false,
        true,
        true,
        true,
        false,
        "Small bodies",
    ]);
    assertEquals(pick("spacecraft"), [
        text,
        "role",
        12,
        0,
        true,
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        "Spacecraft",
    ]);
});

Deno.test("a spacecraft's role is its first tag that names one", () => {
    assertEquals(roleOf({ tags: ["spacecraft", "science"] }), "science");
    assertEquals(roleOf({ tags: ["x", "station", "science"] }), "station");
});

Deno.test("a body with no role tag has the role other", () => {
    assertEquals(roleOf({ tags: ["spacecraft"] }), "other");
    assertEquals(roleOf({ tags: ["spacecraft", "toString"] }), "other");
});
