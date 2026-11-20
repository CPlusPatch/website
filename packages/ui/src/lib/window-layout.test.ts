/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import {
    cascadeAt,
    clamp,
    fit,
    place,
    raise,
    remove,
    top,
} from "./window-layout.ts";

const desktop = { width: 1000, height: 600 };
const size = { width: 400, height: 300 };

Deno.test("a window bigger than the desktop shrinks to fit it", () => {
    assertEquals(fit({ width: 1200, height: 300 }, desktop), {
        width: 1000,
        height: 300,
    });
    assertEquals(fit(size, desktop), size);
});

Deno.test("the cascade steps down and right from its origin", () => {
    assertEquals(cascadeAt(0, size, desktop), { x: 24, y: 24, ...size });
    assertEquals(cascadeAt(2, size, desktop), { x: 88, y: 88, ...size });
});

Deno.test("the cascade starts over before a window crosses the far edge", () => {
    // 600 - 300 - 24 = 276 of room fits steps 0 to 8, so 9 starts over
    assertEquals(cascadeAt(8, size, desktop), { x: 280, y: 280, ...size });
    assertEquals(cascadeAt(9, size, desktop), { x: 24, y: 24, ...size });
});

Deno.test("a window with no room past the origin is fitted and opens at the corner", () => {
    assertEquals(cascadeAt(3, { width: 1200, height: 800 }, desktop), {
        x: 0,
        y: 0,
        ...desktop,
    });
});

Deno.test("a new window takes the first cascade spot no open window sits on", () => {
    const first = cascadeAt(0, size, desktop);
    const third = cascadeAt(2, size, desktop);

    assertEquals(place(size, desktop, []), first);
    assertEquals(place(size, desktop, [third]), first);
    assertEquals(
        place(size, desktop, [first, third]),
        cascadeAt(1, size, desktop),
    );
});

Deno.test("a new window opens at the origin when every spot is taken", () => {
    const tall = { width: 400, height: 560 };
    const open = [cascadeAt(0, tall, desktop), cascadeAt(1, tall, desktop)];

    assertEquals(place(tall, desktop, open), open[0]);
});

Deno.test("a window inside the desktop isn't moved", () => {
    const rect = { x: 100, y: 50, ...size };

    assertEquals(clamp(rect, desktop), rect);
});

Deno.test("a dragged window keeps its title bar's top and a grip of its width on the desktop", () => {
    assertEquals(clamp({ x: -900, y: -40, ...size }, desktop), {
        x: -352,
        y: 0,
        ...size,
    });
    assertEquals(clamp({ x: 2000, y: 900, ...size }, desktop), {
        x: 952,
        y: 552,
        ...size,
    });
});

Deno.test("clamping shrinks a window that outgrew a smaller desktop", () => {
    assertEquals(clamp({ x: 10, y: 10, width: 1200, height: 900 }, desktop), {
        x: 10,
        y: 10,
        ...desktop,
    });
});

Deno.test("raising moves a window to the top, and opens it if it was closed", () => {
    assertEquals(raise(["a", "b", "c"], "a"), ["b", "c", "a"]);
    assertEquals(raise(["a"], "b"), ["a", "b"]);
});

Deno.test("after a window closes, the one now on top gets focus", () => {
    const stack = remove(["a", "b", "c"], "c");

    assertEquals(stack, ["a", "b"]);
    assertEquals(top(stack), "b");
    assertEquals(top(remove(stack, "missing")), "b");
    assertEquals(top([]), undefined);
});
