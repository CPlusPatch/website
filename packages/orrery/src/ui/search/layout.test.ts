/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { MARGIN, panelOffset } from "./layout.ts";

const host = { left: 100, top: 50, right: 1100, bottom: 850 };
const toggle = { left: 300, top: 60, right: 340, bottom: 90 };

Deno.test("the panel sits under the toggle, and its offset is relative to the root", () => {
    assertEquals(panelOffset(host, toggle, undefined, 400), {
        top: 40,
        left: 200,
    });
});

Deno.test("the panel sits under the top bar when there is one", () => {
    assertEquals(panelOffset(host, toggle, 120, 400).top, 70);
});

Deno.test("the panel stops at the right edge of the root", () => {
    const far = { ...toggle, left: 1000 };

    assertEquals(
        panelOffset(host, far, undefined, 400).left,
        1100 - 400 - MARGIN - 100,
    );
});

Deno.test("the panel keeps a margin from the left of the viewport", () => {
    const near = { ...toggle, left: 0 };

    assertEquals(panelOffset(host, near, undefined, 400).left, MARGIN - 100);
});
