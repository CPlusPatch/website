/// <reference types="deno" />
import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { audit } from "./audit.ts";
import { palette, theme } from "./fixture.ts";
import { generate } from "./generate.ts";

Deno.test("generate emits every token in stylesheet order", () => {
    assertEquals(
        [...generate(theme, palette).keys()],
        [
            "bg",
            "bg-alt",
            "surface",
            "surface-raised",
            "text",
            "text-muted",
            "border",
            "border-strong",
            "grid",
            "primary",
            "primary-hover",
            "warning",
            "warning-hover",
            "on-accent",
            "primary-accent",
            "warning-accent",
        ],
    );
});

Deno.test("on-accent is the background", () => {
    const tokens = generate(theme, palette);
    assertEquals(tokens.get("on-accent"), tokens.get("bg"));
});

Deno.test("chroma cap and ratio are applied per tier", () => {
    const capped = generate(theme, {
        ...palette,
        chroma: { ...palette.chroma, cap: 0 },
    });
    // With no chroma at all, every role collapses to the same grey.
    assertEquals(capped.get("primary"), capped.get("warning"));
    assertNotEquals(
        generate(theme, palette).get("primary"),
        capped.get("primary"),
    );
});

Deno.test("audit passes a sound palette and flags a broken one", () => {
    assert(audit(generate(theme, palette), theme).every((row) => row.ok));

    // Role lightness right next to the background cannot reach 4.5:1.
    const washedOut = {
        ...palette,
        tiers: { ...palette.tiers, role: { light: 0.9, dark: 0.25 } },
    };
    const failing = audit(generate(theme, washedOut), theme)
        .filter((row) => !row.ok)
        .map((row) => `${row.scheme} ${row.label}`);
    assertEquals(failing, [
        "light primary (text & fill)",
        "light warning (text & fill)",
        "dark primary (text & fill)",
        "dark warning (text & fill)",
    ]);
});
