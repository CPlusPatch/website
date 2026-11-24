/// <reference types="deno" />
import { assertEquals, assertExists } from "@std/assert";
import {
    arrange,
    type Cascade,
    clamp,
    DEFAULT_CASCADE,
    FOCUS_RING,
    fit,
    GRIP,
    place,
    type Rect,
    raise,
    remove,
    resize,
    reveal,
    type Size,
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

Deno.test("the first window opens at the origin", () => {
    assertEquals(place(size, desktop, []), { x: 24, y: 24, ...size });
});

// A window that leaves no free room: the whole desktop but the margins.
const full = { x: 24, y: 24, width: 952, height: 552 };

Deno.test("a window goes into free room below a short window", () => {
    const short = { x: 24, y: 24, width: 400, height: 200 };
    const open = [short, { x: 448, y: 24, width: 528, height: 552 }];

    // Right of the short one is taken, so it goes below it, a margin away.
    assertEquals(place(size, desktop, open), {
        x: 24,
        y: 248,
        width: 400,
        height: 300,
    });
});

Deno.test("a window goes into free room at the right of a window, before the room below it", () => {
    const open = [{ x: 24, y: 24, width: 400, height: 200 }];

    assertEquals(place(size, desktop, open), {
        x: 448,
        y: 24,
        width: 400,
        height: 300,
    });
});

Deno.test("a window opens a step from the top window when there is no free room and every spot covers the same", () => {
    assertEquals(place(size, desktop, [full]), { ...size, x: 56, y: 56 });
    assertEquals(place(size, desktop, [full], undefined, 0), {
        ...size,
        x: 56,
        y: 56,
    });
});

Deno.test("with every spot covering the same, a window cascades from the top window, not the first", () => {
    const top = { x: 8, y: 8, width: 984, height: 584 };

    assertEquals(place(size, desktop, [full, top]), {
        ...size,
        x: 40,
        y: 40,
    });
});

const leftHalf = { x: 24, y: 24, width: 470, height: 552 };
const rightHalf = { x: 506, y: 24, width: 470, height: 552 };

const overlapping = (a: Rect, b: Rect) =>
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height;

Deno.test("with no free room a window opens over the others and leaves the window it was opened from uncovered", () => {
    const fromRight = place(size, desktop, [leftHalf, rightHalf], undefined, 1);
    const fromLeft = place(size, desktop, [leftHalf, rightHalf], undefined, 0);

    assertEquals(overlapping(fromRight, rightHalf), false);
    assertEquals(overlapping(fromRight, leftHalf), true);
    assertEquals(overlapping(fromLeft, leftHalf), false);
    assertEquals(overlapping(fromLeft, rightHalf), true);
});

Deno.test("a cascade spot is taken over a grid spot that covers a little less", () => {
    const behind = { x: 56, y: 56, width: 300, height: 300 };

    // The grid spot at (312, 248) covers 4% of `behind` on top of `full`. The
    // cascade spot at (248, 248) covers 7% of it, but cascade spots go first.
    assertEquals(place(size, desktop, [full, behind]), {
        ...size,
        x: 248,
        y: 248,
    });
});

Deno.test("over a window that covers the desktop, a tall window opens at its cascade spot at full height, not shrunk at a far spot", () => {
    const tall = { width: 400, height: 900 };

    // 600 - 56 - 24 = 520 tall. The spot at y 216 would cover as much, but
    // leaves only 360.
    assertEquals(place(tall, desktop, [full]), {
        x: 56,
        y: 56,
        width: 400,
        height: 520,
    });
});

Deno.test("a window still leaves every title bar showing when a spot that hides one covers less", () => {
    const left = { x: 24, y: 24, width: 452, height: 552 };
    // Its bar, 200 to 232, shows 96px or more only from a window that ends
    // 96px short of its right edge, or starts below it. The spot at (536, 24)
    // covers little of it but hides the bar. It's too low for a window to
    // shrink to stop short of its top.
    const narrow = { x: 500, y: 200, width: 200, height: 376 };

    const rect = place(size, desktop, [left, narrow]);

    assertEquals(
        rect.y >= narrow.y + DEFAULT_CASCADE.step ||
            rect.x + rect.width <= narrow.x + narrow.width - GRIP,
        true,
    );
});

Deno.test("free room with a spot that needs a small shrink is taken before covering a window", () => {
    const open = [{ x: 24, y: 24, width: 400, height: 300 }];
    const wide = { width: 600, height: 300 };

    // 1000 - 448 - 24 = 528 wide is left at the right of it, a shrink of 12%.
    assertEquals(place(wide, desktop, open), {
        x: 448,
        y: 24,
        width: 528,
        height: 300,
    });
});

Deno.test("a window shrunk to clear the window it was opened from wins over covering it", () => {
    const opener = { x: 400, y: 40, width: 576, height: 536 };
    const left = { x: 24, y: 24, width: 200, height: 200 };

    // From x 56, off `left`, it would end 56px into the opener. Shrunk to
    // 400 - 24 - 56 = 320 wide it stops a gap short, and loses 20% of its
    // area. The cascade off the opener covers it, which counts four times.
    assertEquals(place(size, desktop, [left, opener], undefined, 1), {
        x: 56,
        y: 56,
        width: 320,
        height: 300,
    });
});

Deno.test("a window leaves the left of the title bar of the window it was opened from uncovered", () => {
    const opener = { x: 72, y: 280, width: 904, height: 296 };

    // At x 56 it would hide the opener's icon and title, and still leave
    // more than a grip at the right of its bar. At (184, 56) it would graze
    // the opener by 76px.
    const rect = place(size, desktop, [full, opener], undefined, 1);

    assertEquals(rect, { ...size, x: 184, y: 184 });
    assertEquals(rect.x >= opener.x + GRIP, true);
});

Deno.test("spots of nearly equal cost go to the cascade off the top window", () => {
    const top = { x: 200, y: 200, width: 128, height: 128 };
    const wide = { width: 640, height: 300 };

    // The spot a step from it covers 4.8% of the window on top of the window
    // under it, a grip's overlap of the top one. Another spot covers only the
    // window under it, but this one lines up first.
    assertEquals(place(wide, desktop, [full, top]), {
        ...wide,
        x: 232,
        y: 232,
    });
});

Deno.test("a window that stops short of another beats one that grazes it by less than a grip", () => {
    const left = { x: 24, y: 24, width: 560, height: 552 };
    const right = { x: 600, y: 24, width: 376, height: 552 };
    const wide = { width: 560, height: 500 };

    // From (56, 56) it would end 16px into `right`. Shrunk to 600 - 24 - 56
    // = 520 wide it stops a gap short.
    assertEquals(place(wide, desktop, [left, right]), {
        x: 56,
        y: 56,
        width: 520,
        height: 500,
    });
});

Deno.test("the grid is used when no cascade spot has the room", () => {
    const low = { x: 400, y: 200, width: 576, height: 376 };
    const wide = { width: 700, height: 300 };

    // A step off `low` leaves 544px at the right, short of the 600 a window
    // this wide gets at least.
    assertEquals(place(wide, desktop, [low]), { x: 24, y: 24, ...wide });
});

Deno.test("a window isn't cut short to cover a little less", () => {
    const tall = { width: 400, height: 900 };
    const row = { x: 24, y: 24, width: 952, height: 300 };

    // At y 216 it would be 360 tall and cover 30% of its area, not 52%.
    assertEquals(place(tall, desktop, [row]), {
        x: 56,
        y: 56,
        width: 400,
        height: 520,
    });
});

Deno.test("a window never overlaps another while there is room for it", () => {
    const small = { width: 300, height: 200 };
    const open: Rect[] = [];

    // Two rows of three fit on the desktop, with the margins between.
    for (let n = 0; n < 6; n++) {
        const rect = place(small, desktop, open);

        assertEquals({ width: rect.width, height: rect.height }, small);
        for (const other of open) {
            const apart =
                rect.x >= other.x + other.width ||
                other.x >= rect.x + rect.width ||
                rect.y >= other.y + other.height ||
                other.y >= rect.y + rect.height;

            assertEquals(apart, true, `window ${n} overlaps`);
        }
        open.push(rect);
    }
});

Deno.test("a window skips a cascade spot another window's corner is near, so it doesn't cover its title bar", () => {
    const open = [full, { x: 88, y: 88, width: 300, height: 300 }];
    const top = { x: 56, y: 56, width: 300, height: 300 };

    // (88, 88) is out, and so is every spot within 16px of an edge of the
    // others. Of the rest, this is the first cascade spot that covers the
    // least, give or take the tolerance.
    assertEquals(place(size, desktop, [...open, top]), {
        ...size,
        x: 248,
        y: 248,
    });
});

Deno.test("a window too tall for the room at its spot shrinks and keeps a margin at the far edges", () => {
    const tall = { width: 400, height: 900 };

    // 600 - 24 - 24 = 552 tall at the origin, 520 at the next spot
    assertEquals(place(tall, desktop, []), {
        x: 24,
        y: 24,
        width: 400,
        height: 552,
    });
    assertEquals(place(tall, desktop, [full]), {
        x: 56,
        y: 56,
        width: 400,
        height: 520,
    });
});

Deno.test("a window too wide for the room at its spot shrinks and keeps a margin at the far edges", () => {
    assertEquals(place({ width: 2000, height: 300 }, desktop, []), {
        x: 24,
        y: 24,
        width: 952,
        height: 300,
    });
});

Deno.test("a window with no room down the cascade starts a new column at the top, clear of the others' edges", () => {
    const tall = { width: 400, height: 900 };
    // Spot 13 has 552 - 13 * 32 = 136 tall, under what a window needs
    const open = Array.from({ length: 13 }, (_, n) => ({
        x: 24 + 32 * n,
        y: 24 + 32 * n,
        width: 400,
        height: 300,
    }));

    const rect = place(tall, desktop, open);

    assertEquals([rect.y, rect.width, rect.height], [24, 400, 552]);
    for (const o of open) {
        assertEquals(Math.abs(rect.x - o.x) >= 16, true);
    }
});

Deno.test("a window is never placed smaller than the minimum, or bigger than the desktop", () => {
    // 300 - 24 - 24 = 252 wide and 152 tall are left, under 256 by 160
    assertEquals(place(size, { width: 300, height: 200 }, []), {
        x: 24,
        y: 24,
        width: 256,
        height: 160,
    });
    assertEquals(place(size, { width: 0, height: 0 }, []), {
        x: 24,
        y: 24,
        width: 0,
        height: 0,
    });
});

Deno.test("no window opens at the corner or touches an edge of the desktop", () => {
    const open: Rect[] = [];

    for (let n = 0; n < 40; n++) {
        const rect = place({ width: 1200, height: 900 }, desktop, open);
        open.push(rect);

        assertEquals(rect.x >= 24 && rect.y >= 24, true);
        assertEquals(rect.x + rect.width <= desktop.width - 24, true);
        assertEquals(rect.y + rect.height <= desktop.height - 24, true);
    }
});

Deno.test("two windows that fit sit side by side with the gap, from the margin", () => {
    const a = { width: 400, height: 300 };
    const b = { width: 500, height: 900 };

    // 952 of room, 924 used: the 28 spare go to the right. From bottom to
    // top, so `b` is on top, and on the left.
    assertEquals(arrange([a, b], desktop), [
        // 24 + 500 + 24 gap
        { x: 548, y: 24, ...a },
        // 600 - 24 - 24 = 552 tall
        { x: 24, y: 24, width: 500, height: 552 },
    ]);
});

Deno.test("windows too wide for one row narrow evenly to fit it, and none below the minimum", () => {
    const wide = { width: 600, height: 300 };
    const narrow = { width: 300, height: 300 };

    assertEquals(arrange([wide, wide], desktop), [
        { x: 512, y: 24, width: 464, height: 300 },
        { x: 24, y: 24, width: 464, height: 300 },
    ]);
    // The narrower one keeps its width and the wide one gives up the rest
    assertEquals(
        arrange([{ ...wide, width: 800 }, narrow], desktop).map((r) => [
            r.x,
            r.width,
        ]),
        [
            [348, 628],
            [24, 300],
        ],
    );
});

Deno.test("windows that can't fit in a row even at the minimum overlap evenly, stepping down, the last ending at the far margin", () => {
    const wide = { width: 500, height: 300 };
    const small = { width: 900, height: 600 };

    // 4 * 256 + 3 * 24 is over the 852 of room
    const rects = arrange([wide, wide, wide, wide], small);

    assertEquals(
        rects.map((r) => [r.x, r.y]),
        [
            [24, 24],
            [141, 56],
            [259, 88],
            [376, 120],
        ],
    );
    assertEquals(rects.at(-1)?.x, 900 - 24 - 500);
});

Deno.test("when arranged windows overlap, the top one covers no title bar below it entirely", () => {
    const natural = { width: 576, height: 400 };

    for (const width of [761, 768, 800, 850]) {
        for (const count of [2, 3]) {
            const sizes = Array.from({ length: count }, () => natural);
            const rects = arrange(sizes, { width, height: 600 }, origin16);
            const topRect = rects.at(-1);
            if (!topRect) throw new Error("no windows");

            for (const below of rects.slice(0, -1)) {
                const bar = { ...below, height: origin16.step };
                const covered =
                    topRect.y < bar.y + bar.height &&
                    bar.y < topRect.y + topRect.height;
                const left = Math.max(0, topRect.x - bar.x);
                const right = Math.max(
                    0,
                    bar.x + bar.width - (topRect.x + topRect.width),
                );

                assertEquals(
                    !covered || Math.max(left, right) >= GRIP,
                    true,
                    `at ${width} wide, the top window hides a bar`,
                );
            }
        }
    }
});

Deno.test("arranged windows never end past a margin or start before one", () => {
    const sizes = [
        { width: 900, height: 900 },
        { width: 300, height: 200 },
        { width: 700, height: 400 },
        { width: 2000, height: 2000 },
    ];

    for (let n = 1; n <= sizes.length; n++) {
        for (const rect of arrange(sizes.slice(0, n), desktop)) {
            assertEquals(rect.x >= 24 && rect.y >= 24, true);
            assertEquals(rect.x + rect.width <= desktop.width - 24, true);
            assertEquals(rect.y + rect.height <= desktop.height - 24, true);
        }
    }
});

Deno.test("windows on a desk too narrow to show a grip of each fall back to the cascade", () => {
    const narrow = { width: 400, height: 400 };
    const small = { width: 256, height: 160 };
    const many = Array.from({ length: 4 }, () => small);

    const rects = arrange(many, narrow);

    assertEquals(
        rects.map((r) => [r.x, r.y]),
        [
            [24, 24],
            [56, 56],
            [88, 88],
            [120, 120],
        ],
    );
});

Deno.test("a window inside the desktop isn't moved", () => {
    const rect = { x: 100, y: 50, ...size };

    assertEquals(clamp(rect, desktop), rect);
});

Deno.test("a dragged window can't pass the left or top edge, and keeps a grip of its width at the others", () => {
    // Room for the focus ring: FOCUS_RING from the left and top edges
    assertEquals(clamp({ x: -900, y: -40, ...size }, desktop), {
        x: FOCUS_RING,
        y: FOCUS_RING,
        ...size,
    });
    assertEquals(clamp({ x: 2000, y: 900, ...size }, desktop), {
        x: 904,
        y: 504,
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

Deno.test("resizing adds the amount to the size and keeps the corner", () => {
    const rect = { x: 100, y: 50, ...size };

    assertEquals(resize(rect, { width: 16, height: -16 }, desktop), {
        x: 100,
        y: 50,
        width: 416,
        height: 284,
    });
});

Deno.test("a window grows only to the far margin", () => {
    const rect = { x: 500, y: 200, ...size };
    const { origin } = DEFAULT_CASCADE;

    assertEquals(resize(rect, { width: 400, height: 400 }, desktop), {
        ...rect,
        width: desktop.width - origin.x - rect.x,
        height: desktop.height - origin.y - rect.y,
    });
});

Deno.test("a window shrinks only to the minimum size", () => {
    const rect = { x: 100, y: 50, ...size };
    const { min } = DEFAULT_CASCADE;

    assertEquals(resize(rect, { width: -900, height: -900 }, desktop), {
        ...rect,
        ...min,
    });
});

Deno.test("a window past the far margin doesn't shrink when it's asked to grow, and can still shrink", () => {
    const rect = { x: 900, y: 500, ...size };

    assertEquals(resize(rect, { width: 16, height: 16 }, desktop), rect);
    assertEquals(resize(rect, { width: -16, height: -64 }, desktop), {
        ...rect,
        width: 384,
        height: 236,
    });
});

Deno.test("a window that fits the desktop is moved fully back into view, with the margin at every edge", () => {
    const rect = { x: 624, y: 300, width: 576, height: 200 };
    const small = { width: 800, height: 600 };

    // 800 - 576 - 24 = 200 across; 600 - 200 - 24 = 376 down, so y stays
    assertEquals(reveal(rect, small), { ...rect, x: 200 });
    assertEquals(reveal({ ...rect, x: -300, y: -50 }, small), {
        ...rect,
        x: 24,
        y: 24,
    });
    assertEquals(reveal({ ...rect, x: 100, y: 100 }, small), {
        ...rect,
        x: 100,
        y: 100,
    });
});

Deno.test("a window too big for the margins is shrunk to fit inside them, down to the minimum size", () => {
    assertEquals(
        reveal(
            { x: 30, y: 30, width: 800, height: 600 },
            { width: 800, height: 600 },
        ),
        { x: 24, y: 24, width: 752, height: 552 },
    );
    assertEquals(
        reveal(
            { x: 10, y: 10, width: 1200, height: 900 },
            { width: 800, height: 600 },
        ),
        { x: 24, y: 24, width: 752, height: 552 },
    );
    assertEquals(
        reveal(
            { x: 200, y: 277, width: 500, height: 779 },
            { width: 1000, height: 707 },
        ),
        { x: 200, y: 24, width: 500, height: 659 },
    );
    // Not below the minimum, even where that leaves no room for a margin
    assertEquals(
        reveal(
            { x: 10, y: 10, width: 900, height: 900 },
            { width: 280, height: 200 },
        ),
        { x: 10, y: 10, width: 256, height: 160 },
    );
});

Deno.test("revealing the rect a window is meant to have gives it back after the desktop grows again", () => {
    const meant = { x: 648, y: 16, width: 576, height: 707 };
    const cascade = origin16;

    const small = reveal(meant, { width: 761, height: 419 }, cascade);

    assertEquals(small.x >= 16 && small.y >= 16, true);
    assertEquals(small.x + small.width <= 761 - 16, true);
    assertEquals(small.y + small.height <= 419 - 16, true);
    assertEquals(reveal(meant, { width: 1280, height: 739 }, cascade), meant);
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

// The opening windows are README and Terminal, then each next app in turn.
const naturalHeights = [691, 379, 372, 663, 255, 779, 651, 264];

/** Opens eight windows in turn, the first two as `arrange` sets them. */
const openEight = (desk: Size, cascade: Cascade) => {
    const width = Math.round(Math.min(Math.max(0.4 * desk.width, 576), 832));
    const sizes = naturalHeights.map((height) => ({ width, height }));
    const [readme, terminal, ...later] = sizes;
    assertExists(readme);
    assertExists(terminal);

    // README is on top, so Terminal goes first.
    const open = arrange([terminal, readme], desk, cascade);
    const placed = [...open];

    for (const natural of later) {
        // The top window is the last one.
        placed.push(place(natural, desk, placed, cascade));
    }

    return { sizes: [terminal, readme, ...later], placed };
};

const origin16 = { ...DEFAULT_CASCADE, origin: { x: 16, y: 16 } };
const deskSizes = [
    { width: 1024, height: 700 },
    { width: 1280, height: 739 },
    { width: 1920, height: 1019 },
];

for (const desk of deskSizes) {
    const name = `${desk.width} by ${desk.height}`;

    Deno.test(`eight windows opened in turn on a ${name} desk leave no sliver between edges`, () => {
        const { placed } = openEight(desk, origin16);

        for (const [i, rect] of placed.entries()) {
            for (const other of placed.slice(0, i)) {
                for (const [a, b, along] of [
                    [rect.x, other.x, "left"],
                    [rect.y, other.y, "top"],
                ] as const) {
                    const apart = Math.abs(a - b);

                    assertEquals(
                        apart === 0 || apart >= 16,
                        true,
                        `window ${i} ${along} is ${apart}px from another`,
                    );
                }
            }
        }
    });

    Deno.test(`eight windows opened in turn on a ${name} desk each get three quarters of 60% of the desk, or of their own size`, () => {
        const { sizes, placed } = openEight(desk, origin16);

        for (const [i, rect] of placed.entries()) {
            const size = sizes[i];
            assertExists(size);

            // A window can be shrunk by a quarter to line up or to fit.
            assertEquals(
                rect.width >=
                    Math.ceil(0.75 * Math.min(size.width, 0.6 * desk.width)) ||
                    // The pair is narrowed to fit side by side.
                    i < 2,
                true,
                `window ${i} is ${rect.width} wide`,
            );
            assertEquals(
                rect.height >=
                    Math.ceil(0.75 * Math.min(size.height, 0.6 * desk.height)),
                true,
                `window ${i} is ${rect.height} tall`,
            );
        }
    });

    Deno.test(`the first four windows on a ${name} desk each leave a grip of the others' title bars showing`, () => {
        const { placed } = openEight(desk, origin16);

        for (const [i, rect] of placed.slice(0, 4).entries()) {
            for (const other of placed.slice(0, i)) {
                const bar = { ...other, height: origin16.step };
                const covered =
                    rect.y < bar.y + bar.height && bar.y < rect.y + rect.height;
                const left = Math.max(0, rect.x - bar.x);
                const right = Math.max(
                    0,
                    bar.x + bar.width - (rect.x + rect.width),
                );

                assertEquals(
                    !covered || Math.max(left, right) >= GRIP,
                    true,
                    `window ${i} covers the bar of another`,
                );
            }
        }
    });
}

Deno.test("the windows arranged at load start at the margin, and the next one opens in the free room under the second", () => {
    const desk = { width: 1280, height: 739 };
    const { placed } = openEight(desk, origin16);
    const [readme, terminal] = placed;
    assertExists(readme);
    assertExists(terminal);

    assertEquals(terminal.x, 16);
    // The pair's room left over is on the right: 16 + 576 + 16 + 576 = 1184
    assertEquals(readme.x + readme.width, 16 + 576 + 16 + 576);
    // Under Terminal, a gap away, with the room there: 739 - 411 - 16 = 312
    assertEquals(placed[2], { x: 608, y: 411, width: 576, height: 312 });
});

Deno.test("windows are narrowed beside each other only to three quarters of their own width", () => {
    const natural = { width: 576, height: 400 };
    const pair = [natural, natural];

    // 761: 729 of room, and 2 * 432 + 16 is over it, so they overlap, not narrow
    const overlapped = arrange(pair, { width: 761, height: 600 }, origin16);
    assertEquals(
        overlapped.map((r) => [r.x, r.width]),
        [
            [16, 576],
            [169, 576],
        ],
    );
    const [back, front] = overlapped;
    assertExists(back);
    assertExists(front);
    assertEquals(front.y > back.y, true);

    // 1024: 992 of room, so they narrow evenly, above the floor of 432
    const beside = arrange(pair, { width: 1024, height: 600 }, origin16);
    assertEquals(
        beside.map((r) => [r.x, r.y, r.width]),
        [
            [520, 16, 488],
            [16, 16, 488],
        ],
    );
});

Deno.test("a window isn't narrowed below its content's floor", () => {
    const wide = { width: 576, height: 400 };
    const pair = [wide, { ...wide, floor: 520 }];

    // 1024: 992 of room. Evenly they'd be 488 each, under the second's floor.
    const rects = arrange(pair, { width: 1024, height: 600 }, origin16);

    const [, second] = rects;
    assertExists(second);
    assertEquals(second.width >= 520, true);
    assertEquals(
        rects.map((r) => [r.x, r.width]),
        [
            [552, 456],
            [16, 520],
        ],
    );
});

Deno.test("windows whose floors don't fit side by side overlap instead of narrowing", () => {
    const wide = { width: 576, height: 400, floor: 500 };

    // 1000 + 16 is over the 992 of room, though 2 * 432 + 16 isn't
    const rects = arrange([wide, wide], { width: 1024, height: 600 }, origin16);

    assertEquals(
        rects.map((r) => r.width),
        [576, 576],
    );
    const [first, second] = rects;
    assertExists(first);
    assertExists(second);
    assertEquals(second.y > first.y, true);
});

Deno.test("windows of one width are narrowed to one width, with the spare pixel on the right", () => {
    const natural = { width: 400, height: 300 };

    // 761: 729 of room, 713 for the windows, so 356 each and 1 spare
    const rects = arrange(
        [natural, natural],
        { width: 761, height: 600 },
        origin16,
    );

    assertEquals(
        rects.map((r) => r.width),
        [356, 356],
    );
    // The top window is the last, and on the left
    const [first, second] = rects;
    assertExists(first);
    assertExists(second);
    assertEquals(second.x, 16);
    assertEquals(first.x + first.width <= 761 - 16, true);
});
