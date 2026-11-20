/// <reference types="deno" />
import { assertEquals } from "@std/assert";
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

Deno.test("a window opens a step from the top window when there is no free room", () => {
    const behind = { x: 56, y: 56, width: 300, height: 300 };
    const above = { x: 40, y: 90, width: 300, height: 300 };

    assertEquals(place(size, desktop, [full]), { ...size, x: 56, y: 56 });
    assertEquals(place(size, desktop, [full, behind]), {
        ...size,
        x: 88,
        y: 88,
    });
    // The step is from the last window, which is the top one.
    assertEquals(place(size, desktop, [full, above]), {
        ...size,
        x: 72,
        y: 122,
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

    assertEquals(place(size, desktop, [...open, top]), {
        ...size,
        x: 120,
        y: 120,
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
    // README is on top, so Terminal goes first.
    const open = arrange([sizes[1], sizes[0]], desk, cascade);
    const placed = [...open];

    for (const natural of sizes.slice(2)) {
        // The top window is the last one.
        placed.push(place(natural, desk, placed, cascade));
    }

    return { sizes: [sizes[1], sizes[0], ...sizes.slice(2)], placed };
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

    Deno.test(`eight windows opened in turn on a ${name} desk each get 60% of the desk, or their own size`, () => {
        const { sizes, placed } = openEight(desk, origin16);

        for (const [i, rect] of placed.entries()) {
            assertEquals(
                rect.width >= Math.min(sizes[i].width, 0.6 * desk.width) ||
                    // The pair is narrowed to fit side by side.
                    i < 2,
                true,
                `window ${i} is ${rect.width} wide`,
            );
            assertEquals(
                rect.height >= Math.min(sizes[i].height, 0.6 * desk.height),
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

Deno.test("the windows arranged at load start at the margin, and the next one cascades from the top one", () => {
    const desk = { width: 1280, height: 739 };
    const { placed } = openEight(desk, origin16);

    assertEquals(placed[1].x, 16);
    // The pair's room left over is on the right: 16 + 576 + 16 + 576 = 1184
    assertEquals(placed[0].x + placed[0].width, 16 + 576 + 16 + 576);
    // README is on top, so the third window cascades from its corner
    assertEquals([placed[2].x, placed[2].y], [16 + 32, 16 + 32]);
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
    assertEquals(overlapped[1].y > overlapped[0].y, true);

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
    assertEquals(rects[1].x, 16);
    assertEquals(rects[0].x + rects[0].width <= 761 - 16, true);
});
