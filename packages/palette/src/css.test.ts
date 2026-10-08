/// <reference types="deno" />
import { assertEquals, assertMatch, assertThrows } from "@std/assert";
import { updateStylesheet } from "./css.ts";
import type { Tokens } from "./generate.ts";

const tokens: Tokens = new Map([
    ["bg", { light: "#ffffff", dark: "#000000" }],
    ["text", { light: "#111111", dark: "#eeeeee" }],
]);

const stylesheet = (...body: string[]) =>
    [
        "/* Header */",
        ":root {",
        "    /* palette:start */",
        ...body,
        "    /* palette:end */",
        "    --color-hand-written: red;",
        "}",
    ].join("\n");

Deno.test("an up-to-date stylesheet is left alone", () => {
    const css = stylesheet(
        "    /* Neutrals */",
        "    --color-bg: light-dark(#ffffff, #000000);",
        "",
        "    --color-text: light-dark(#111111, #eeeeee);",
    );
    assertEquals(updateStylesheet(css, tokens), { css, changes: [] });
});

Deno.test("values are rewritten in place, keeping comments and order", () => {
    const { css, changes } = updateStylesheet(
        stylesheet(
            "    --color-text: light-dark(#222222, #eeeeee);",
            "    /* Neutrals */",
            "    --color-bg: light-dark(#ffffff, #000000);",
        ),
        tokens,
    );
    assertEquals(
        css,
        stylesheet(
            "    --color-text: light-dark(#111111, #eeeeee);",
            "    /* Neutrals */",
            "    --color-bg: light-dark(#ffffff, #000000);",
        ),
    );
    assertEquals(changes, [
        "~ --color-text: light-dark(#222222, #eeeeee) -> light-dark(#111111, #eeeeee)",
    ]);
});

Deno.test("stale tokens are removed and new ones appended", () => {
    const { css, changes } = updateStylesheet(
        stylesheet(
            "    --color-bg: light-dark(#ffffff, #000000);",
            "    --color-gone: light-dark(#123456, #654321);",
        ),
        tokens,
    );
    assertEquals(
        css,
        stylesheet(
            "    --color-bg: light-dark(#ffffff, #000000);",
            "    --color-text: light-dark(#111111, #eeeeee);",
        ),
    );
    assertEquals(changes, ["- --color-gone", "+ --color-text"]);
});

Deno.test("declarations outside the markers are never touched", () => {
    const { css } = updateStylesheet(stylesheet(), tokens);
    assertMatch(css, /--color-hand-written: red;/);
});

Deno.test("a stylesheet without markers is an error", () => {
    assertThrows(() => updateStylesheet(":root {}", tokens), Error, "markers");
});
