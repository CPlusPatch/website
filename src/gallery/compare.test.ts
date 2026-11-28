/// <reference types="deno" />

import { STYLES } from "@cpluspatch/ui/styles/styles/index.ts";
import { THEMES } from "@cpluspatch/ui/styles/themes/index.ts";
import { assertEquals } from "@std/assert";
import { COMPARE_MODES, copies } from "./compare.ts";

Deno.test("copies: light and dark by scheme", () => {
    assertEquals(copies("schemes"), [
        { label: "Light", params: { scheme: "light" } },
        { label: "Dark", params: { scheme: "dark" } },
    ]);
});

Deno.test("copies: one per theme, and one per style", () => {
    assertEquals(
        copies("themes").map((c) => c.params),
        THEMES.map((t) => ({ theme: t.value })),
    );
    assertEquals(
        copies("styles").map((c) => c.params),
        STYLES.map((s) => ({ style: s.value })),
    );
});

Deno.test("copies: none when off", () => {
    assertEquals(copies("off"), []);
});

Deno.test("COMPARE_MODES: light and dark first, off last", () => {
    assertEquals(
        COMPARE_MODES.map((m) => m.value),
        ["schemes", "themes", "styles", "off"],
    );
});
