import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures.ts";

/**
 * The window manager on /desktop: plain sections without JS or on a phone,
 * stacked, draggable windows with it.
 */
const APPS = [
    "w-readme",
    "w-terminal",
    "w-projects",
    "w-p-versia",
    "w-p-website",
    "w-p-join-mastodon",
    "w-p-flavi",
    "w-p-kitsu-life",
    "w-monitor",
    "w-letters",
    "w-radio",
    "w-chat",
    "w-toys",
];

/** How much of a window must stay on the desk (`GRIP` in lib/window-layout.ts). */
const GRIP = 96;

/** The margin kept at the desk's far edges (the desk bar's padding). */
const MARGIN = 16;

/** How far a cascade step is (`DEFAULT_CASCADE.step`). */
const STEP = 32;

type Rect = { x: number; y: number; width: number; height: number };

const windows = (page: Page) => page.locator(".desk > .window");

const open = async (page: Page, width = 1280, height = 800) => {
    await page.setViewportSize({ width, height });
    await page.goto("/desktop/");
    await expect(page.locator(".desk")).toHaveClass(/window-manager--on/);
};

const box = async (locator: Locator) => {
    const found = await locator.boundingBox();
    if (!found) throw new Error(`${locator} has no box`);
    return found;
};

/**
 * Whether `GRIP` px of a title bar stay visible with `over` on top of it, or
 * its top `step` px, the library's idea of a bar (`barShows` in lib/window-layout.ts).
 */
const barShows = (bar: Rect, over: Rect) => {
    const overlaps =
        Math.min(bar.x + bar.width, over.x + over.width) >
            Math.max(bar.x, over.x) &&
        Math.min(bar.y + bar.height, over.y + over.height) >
            Math.max(bar.y, over.y);
    if (!overlaps) return true;

    const left = Math.max(0, over.x - bar.x);
    const right = Math.max(0, bar.x + bar.width - (over.x + over.width));
    const above = over.y - bar.y;

    return (
        above >= STEP - 1 || Math.max(left, right) >= Math.min(GRIP, bar.width)
    );
};

const zIndex = (locator: Locator) =>
    locator.evaluate((el) => Number(getComputedStyle(el).zIndex));

/** Opens every window, one after another, the way a link to it does. */
const openAll = async (page: Page) => {
    for (const id of APPS) {
        await page.evaluate((target) => {
            const link = document.createElement("a");
            link.href = `#${target}`;
            document.body.append(link);
            link.click();
            link.remove();
        }, id);
        await expect(page.locator(`#${id}`)).toBeVisible();
    }
};

/** The ids of the windows that are open. */
const openIds = async (page: Page) => [...(await openBoxes(page)).keys()];

/** The boxes of the windows that are open, by id. */
const openBoxes = async (page: Page) => {
    const boxes = new Map<string, Awaited<ReturnType<typeof box>>>();
    for (const id of APPS) {
        const win = page.locator(`#${id}`);
        if (await win.isVisible()) boxes.set(id, await box(win));
    }
    return boxes;
};

/** The window's title bar and top edge are on the desk, enough to be grabbed. */
const reachable = async (page: Page, id: string) => {
    const desk = await box(page.locator(".desk"));
    const win = await box(page.locator(`#${id}`));

    expect(win.y, `${id} top`).toBeGreaterThanOrEqual(desk.y - 1);
    expect(win.y, `${id} top`).toBeLessThanOrEqual(
        desk.y + desk.height - GRIP + 1,
    );
    expect(win.x + win.width, `${id} right`).toBeGreaterThanOrEqual(
        desk.x + GRIP - 1,
    );
    expect(win.x, `${id} left`).toBeLessThanOrEqual(
        desk.x + desk.width - GRIP + 1,
    );
};

test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("every app is a visible section in reading order, with no close button", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto("/desktop/");

        const ids = await windows(page).evaluateAll((els) =>
            els.map((el) => el.id),
        );
        expect(ids).toEqual(APPS);

        let previous = -1;
        for (const id of APPS) {
            const section = page.locator(`#${id}`);
            await expect(section).toBeVisible();

            const { y } = await box(section);
            expect(y, `${id} is below the one before`).toBeGreaterThan(
                previous,
            );
            previous = y;
        }
        await expect(page.locator(".window__close:visible")).toHaveCount(0);
    });
});

test("below 760px wide, the windows stay plain sections", async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    await page.goto("/desktop/");
    await page.waitForLoadState("load");

    await expect(windows(page)).toHaveCount(APPS.length);
    await expect(page.locator(".window--framed")).toHaveCount(0);
    await expect(page.locator(".desk")).not.toHaveClass(/window-manager--on/);
});

test("at load only README and Terminal are open, README on top and active", async ({
    page,
}) => {
    await open(page);

    await expect(page.locator(".desk > .window--framed")).toHaveCount(
        APPS.length,
    );
    for (const id of APPS) {
        const win = page.locator(`#${id}`);
        if (id === "w-readme" || id === "w-terminal") {
            await expect(win).toBeVisible();
        } else {
            await expect(win).toBeHidden();
        }
    }

    expect(await zIndex(page.locator("#w-readme"))).toBeGreaterThan(
        await zIndex(page.locator("#w-terminal")),
    );
    await expect(page.locator("#w-readme")).toHaveClass(/window--active/);
    await expect(page.locator(".window--active")).toHaveCount(1);
});

test("README and Terminal at load sit side by side, clear of the edges", async ({
    page,
}) => {
    await open(page);

    const desk = await box(page.locator(".desk"));
    const readme = await box(page.locator("#w-readme"));
    const terminal = await box(page.locator("#w-terminal"));
    const overlapWidth = Math.max(
        0,
        Math.min(readme.x + readme.width, terminal.x + terminal.width) -
            Math.max(readme.x, terminal.x),
    );
    const overlapHeight = Math.max(
        0,
        Math.min(readme.y + readme.height, terminal.y + terminal.height) -
            Math.max(readme.y, terminal.y),
    );

    expect(overlapWidth * overlapHeight).toBeLessThanOrEqual(
        0.25 * terminal.width * terminal.height,
    );
    for (const win of [readme, terminal]) {
        expect(win.x - desk.x).toBeGreaterThanOrEqual(MARGIN - 1);
        expect(win.y - desk.y).toBeGreaterThanOrEqual(MARGIN - 1);
        expect(
            desk.x + desk.width - (win.x + win.width),
        ).toBeGreaterThanOrEqual(MARGIN - 1);
        expect(
            desk.y + desk.height - (win.y + win.height),
        ).toBeGreaterThanOrEqual(MARGIN - 1);
    }
});

for (const [width, height] of [
    [768, 800],
    [1024, 768],
    [1280, 800],
] as const) {
    test(`at ${width}px wide every window opening at load leaves a grip of another's title bar`, async ({
        page,
    }) => {
        await open(page, width, height);

        const ids = ["w-readme", "w-terminal"];
        for (const id of ids) {
            const bar = await box(page.locator(`#${id} .window__bar`));
            for (const other of ids.filter((o) => o !== id)) {
                const win = await box(page.locator(`#${other}`));
                expect(
                    barShows(bar, win),
                    `${other} covers the bar of ${id}`,
                ).toBe(true);
            }
        }
    });
}

for (const [width, height] of [
    [768, 1024],
    [800, 600],
] as const) {
    test(`at ${width} by ${height} both titles are visible at load, with README not covering Terminal's`, async ({
        page,
    }) => {
        await open(page, width, height);

        // README is on top, so only it can cover Terminal's title. Terminal's
        // own rect may reach under README's title, which still shows.
        const terminal = await box(page.locator("#w-terminal-title"));
        const readme = await box(page.locator("#w-readme"));
        const covered =
            terminal.x < readme.x + readme.width &&
            readme.x < terminal.x + terminal.width &&
            terminal.y < readme.y + readme.height &&
            readme.y < terminal.y + terminal.height;

        expect(covered, "README covers the title of Terminal").toBe(false);
        await expect(page.locator("#w-readme-title")).toBeInViewport();
        await expect(page.locator("#w-terminal-title")).toBeInViewport();
    });
}

test("open windows are inside the desk and clear of its edges, at load and with all open", async ({
    page,
}) => {
    await open(page);

    for (const when of ["at load", "with all open"]) {
        if (when === "with all open") await openAll(page);

        const desk = await box(page.locator(".desk"));
        for (const [id, win] of await openBoxes(page)) {
            expect(win.x - desk.x, `${when}: ${id} left`).toBeGreaterThan(0);
            expect(win.y - desk.y, `${when}: ${id} top`).toBeGreaterThan(0);
            expect(
                desk.x + desk.width - (win.x + win.width),
                `${when}: ${id} right`,
            ).toBeGreaterThanOrEqual(MARGIN - 1);
            expect(
                desk.y + desk.height - (win.y + win.height),
                `${when}: ${id} bottom`,
            ).toBeGreaterThanOrEqual(MARGIN - 1);
        }
    }
});

test("no two open windows share a top-left corner after opening them all by link", async ({
    page,
}) => {
    await open(page);

    await openAll(page);

    const boxes = await openBoxes(page);
    expect(boxes.size).toBe(APPS.length);

    const corners = [...boxes.values()].map(
        (win) => `${Math.round(win.x)},${Math.round(win.y)}`,
    );
    expect(new Set(corners).size).toBe(corners.length);
});

/** The size a window would open at, without the desk's room limiting it. */
const naturalSize = (page: Page, id: string) =>
    page.evaluate((target) => {
        const el = document.getElementById(target);
        if (!el) throw new Error(`no #${target}`);

        const saved = el.getAttribute("style");
        el.style.width = "";
        el.style.height = "";
        el.style.setProperty("--window-max-width", "100vw");
        el.style.setProperty("--window-max-height", "100vh");
        const size = { width: el.offsetWidth, height: el.offsetHeight };
        if (saved === null) el.removeAttribute("style");
        else el.setAttribute("style", saved);

        return size;
    }, id);

test("opening each closed window in turn leaves no sliver between edges, and each window at least 60% of the desk or its natural size", async ({
    page,
}) => {
    await open(page, 1280, 800);

    const desk = await box(page.locator(".desk"));
    const opened = ["w-readme", "w-terminal"];
    const closed = APPS.filter((id) => !opened.includes(id));

    for (const id of closed) {
        await page.evaluate((target) => {
            const link = document.createElement("a");
            link.href = `#${target}`;
            document.body.append(link);
            link.click();
            link.remove();
        }, id);
        await expect(page.locator(`#${id}`)).toBeVisible();
        opened.push(id);

        const boxes = await openBoxes(page);
        for (const [a, first] of boxes) {
            for (const [b, second] of boxes) {
                if (a >= b) continue;

                for (const edge of ["x", "y"] as const) {
                    const gap = Math.abs(first[edge] - second[edge]);
                    expect(
                        gap < 1 || gap >= 16,
                        `after ${id}: ${a} and ${b} are ${gap}px apart on ${edge}`,
                    ).toBe(true);
                }
            }
        }

        // The pair open at load is narrowed to fit side by side, so it's exempt.
        for (const target of opened.slice(2)) {
            const natural = await naturalSize(page, target);
            const win = boxes.get(target);
            if (!win) throw new Error(`${target} isn't open`);

            expect(
                win.width,
                `after ${id}: ${target} width`,
            ).toBeGreaterThanOrEqual(
                Math.min(natural.width, 0.6 * desk.width) - 1,
            );
            expect(
                win.height,
                `after ${id}: ${target} height`,
            ).toBeGreaterThanOrEqual(
                Math.min(natural.height, 0.6 * desk.height) - 1,
            );
        }
    }
});

test("shrinking the desk before touching anything lays the windows out as a load at that size", async ({
    page,
}) => {
    await open(page, 768, 800);
    const loaded = await openBoxes(page);

    await open(page, 1280, 800);
    await page.setViewportSize({ width: 768, height: 800 });

    await expect(async () => {
        const shrunk = await openBoxes(page);
        expect([...shrunk.keys()]).toEqual([...loaded.keys()]);
        for (const [id, win] of loaded) {
            expect(shrunk.get(id), id).toEqual(win);
        }
    }).toPass();
});

test("shrinking the desk after moving a window keeps its place instead of laying it out again", async ({
    page,
}) => {
    await open(page, 1280, 800);

    const bar = await box(page.locator("#w-terminal .window__bar"));
    await page.mouse.move(bar.x + 100, bar.y + bar.height / 2);
    await page.mouse.down();
    await page.mouse.move(bar.x + 100, bar.y + bar.height / 2 + 60, {
        steps: 4,
    });
    await page.mouse.up();
    const moved = await box(page.locator("#w-terminal"));

    await page.setViewportSize({ width: 1180, height: 800 });

    await expect(async () => {
        const after = await box(page.locator("#w-terminal"));
        expect(after.y).toBeCloseTo(moved.y, 0);
    }).toPass();
});

test("a link to a window raises it, focuses its title and sets the URL", async ({
    page,
}) => {
    await open(page);

    await page.locator('#w-readme a[href="#w-terminal"]').click();

    const terminal = await zIndex(page.locator("#w-terminal"));
    expect(terminal).toBeGreaterThan(await zIndex(page.locator("#w-readme")));
    await expect(page.locator("#w-terminal-title")).toBeFocused();
    expect(new URL(page.url()).hash).toBe("#w-terminal");
});

test("Escape closes the window it's pressed in and focuses the next one", async ({
    page,
}) => {
    await open(page);

    await page.locator("#w-readme-title").focus();
    await page.keyboard.press("Escape");

    await expect(page.locator("#w-readme")).toBeHidden();
    await expect(page.locator("#w-terminal-title")).toBeFocused();
});

test("a closed window reopens from a link to it, on top with its title focused", async ({
    page,
}) => {
    await open(page);
    await page.getByRole("button", { name: "Close Terminal" }).click();
    await expect(page.locator("#w-terminal")).toBeHidden();

    await page.locator('#w-readme a[href="#w-terminal"]').click();

    await expect(page.locator("#w-terminal")).toBeVisible();
    await expect(page.locator("#w-terminal-title")).toBeFocused();
    expect(await zIndex(page.locator("#w-terminal"))).toBeGreaterThan(
        await zIndex(page.locator("#w-readme")),
    );
});

test("loading a URL with a window's hash opens that window on top", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/desktop/#w-projects");
    await expect(page.locator(".desk")).toHaveClass(/window-manager--on/);

    await expect(page.locator("#w-projects")).toBeVisible();
    await expect(page.locator("#w-projects")).toHaveClass(/window--active/);
    await expect(page.locator("#w-projects-title")).toBeFocused();
    for (const id of ["w-readme", "w-terminal"]) {
        expect(await zIndex(page.locator("#w-projects"))).toBeGreaterThan(
            await zIndex(page.locator(`#${id}`)),
        );
    }
});

test("a window that was never resized returns to its width when the desk grows back", async ({
    page,
}) => {
    // 40vw is 768px here, more than the 760px desk below
    await open(page, 1920, 1000);
    const before = (await box(page.locator("#w-readme"))).width;

    await page.setViewportSize({ width: 760, height: 1000 });
    await expect(async () => {
        expect((await box(page.locator("#w-readme"))).width).toBeLessThan(
            before,
        );
    }).toPass();

    await page.setViewportSize({ width: 1920, height: 1000 });

    await expect(async () => {
        expect((await box(page.locator("#w-readme"))).width).toBeCloseTo(
            before,
            0,
        );
    }).toPass();
});

test("raising another window drops a window's hash from the URL", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/desktop/#w-projects");
    await expect(page.locator("#w-projects")).toHaveClass(/window--active/);

    await page
        .locator("#w-readme .window__bar")
        .click({ position: { x: 300, y: 4 } });

    await expect(page.locator("#w-readme")).toHaveClass(/window--active/);
    expect(new URL(page.url()).hash).toBe("");
});

test("a link to an open window doesn't add a history entry, one to a closed window does", async ({
    page,
}) => {
    await open(page);
    const entries = () => page.evaluate(() => history.length);
    const before = await entries();

    await page.locator('#w-readme a[href="#w-terminal"]').click();
    expect(await entries()).toBe(before);

    await page.getByRole("button", { name: "Close Terminal" }).click();
    await page.locator('#w-readme a[href="#w-terminal"]').click();
    expect(await entries()).toBe(before + 1);
});

test("pressing Escape while dragging a window closes it and ends the drag", async ({
    page,
    problems,
}) => {
    await open(page);
    const grab = await box(page.locator("#w-readme .window__bar"));
    const [x, y] = [grab.x + grab.width / 2, grab.y + grab.height / 2];

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 50, y + 30, { steps: 3 });
    await page.keyboard.press("Escape");
    await page.mouse.up();

    await expect(page.locator("#w-readme")).toBeHidden();
    await expect(page.locator(".window--dragging")).toHaveCount(0);
    await expect(page.locator("#w-terminal-title")).toBeFocused();
    expect(problems).toEqual([]);
});

test("pressing a window's bar focuses it, so Escape then closes it", async ({
    page,
}) => {
    await open(page);

    await page.locator("#w-terminal .window__bar").click();
    await expect(page.locator("#w-terminal-title")).toBeFocused();
    await page.keyboard.press("Escape");

    await expect(page.locator("#w-terminal")).toBeHidden();
    await expect(page.locator("#w-readme-title")).toBeFocused();
});

test("a mouse press on a bar focuses the title without a focus ring, and Escape still closes it", async ({
    page,
}) => {
    await open(page);

    await page.locator("#w-terminal .window__bar").click();
    const title = page.locator("#w-terminal-title");

    await expect(title).toBeFocused();
    expect(await title.evaluate((el) => el.matches(":focus-visible"))).toBe(
        false,
    );
    await page.keyboard.press("Escape");

    await expect(page.locator("#w-terminal")).toBeHidden();
});

test("a link followed by key puts the focus ring on the window's bar, not its title", async ({
    page,
}) => {
    await open(page);

    await page.locator('#w-readme a[href="#w-terminal"]').focus();
    await page.keyboard.press("Enter");
    const title = page.locator("#w-terminal-title");

    await expect(title).toBeFocused();
    expect(await title.evaluate((el) => el.matches(":focus-visible"))).toBe(
        true,
    );
    expect(
        await title.evaluate((el) => getComputedStyle(el).outlineStyle),
    ).toBe("none");
    expect(
        await page
            .locator("#w-terminal .window__bar")
            .evaluate((el) => getComputedStyle(el).outlineStyle),
    ).toBe("solid");
});

test("the manager turns off below 760px after load, and on again above it", async ({
    page,
}) => {
    await open(page);
    const opened = await openIds(page);
    expect(opened).toEqual(["w-readme", "w-terminal"]);

    await page.setViewportSize({ width: 700, height: 900 });

    await expect(page.locator(".window--framed")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveClass(/wm/);
    await expect(page.locator(".desk")).not.toHaveClass(/window-manager--on/);
    // The plain page again: nothing the manager added is left.
    await expect(page.locator(".desk > .window[hidden]")).toHaveCount(0);
    await expect(page.locator(".desk > .window[style]")).toHaveCount(0);
    await expect(page.locator(".window--active")).toHaveCount(0);
    await expect(page.locator(".window__close[hidden]")).toHaveCount(
        APPS.length,
    );
    await expect(page.locator(".window__close:visible")).toHaveCount(0);
    await expect(page.locator(".window__body[tabindex]")).toHaveCount(0);
    await expect(page.locator(".window__body[role]")).toHaveCount(0);
    await expect(page.locator(".window__body[aria-labelledby]")).toHaveCount(0);
    await expect(page.locator("#w-projects")).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 800 });

    await expect(page.locator(".desk")).toHaveClass(/window-manager--on/);
    await expect(page.locator("html")).toHaveClass(/wm/);
    await expect(page.locator(".window--framed")).toHaveCount(APPS.length);
    await expect(page.locator("#w-readme")).toHaveClass(/window--active/);
    await expect(page.locator(".window__close:visible")).toHaveCount(
        opened.length,
    );
    expect(await openIds(page)).toEqual(opened);
});

test("closing the window named in the URL drops the hash", async ({ page }) => {
    await open(page);
    await page.locator('#w-readme a[href="#w-terminal"]').click();
    expect(new URL(page.url()).hash).toBe("#w-terminal");

    await page.getByRole("button", { name: "Close Terminal" }).click();

    await expect(page.locator("#w-terminal")).toBeHidden();
    expect(new URL(page.url()).hash).toBe("");
});

test("Escape in a window's scroll body closes it", async ({ page }) => {
    await open(page);

    await page.locator("#w-readme .window__body").focus();
    await page.keyboard.press("Escape");

    await expect(page.locator("#w-readme")).toBeHidden();
});

test("Escape typed in the terminal's input doesn't close its window", async ({
    page,
}) => {
    await open(page);

    await page.locator("#w-terminal input").focus();
    await page.keyboard.press("Escape");

    await expect(page.locator("#w-terminal")).toBeVisible();
});

/** Open `id` as a link press would, with no pointer, and wait for it. */
const openFromScript = async (page: Page, id: string) => {
    await page.evaluate((target) => {
        location.hash = target;
    }, id);
    await expect(page.locator(`#${id}`)).toBeVisible();
};

const ringed = (page: Page, id: string) =>
    page.locator(`#${id}-title`).evaluate((el) => el.matches(":focus-visible"));

test("a mouse click on a window link opens it without a focus ring, and a key keeps it", async ({
    page,
}) => {
    await open(page);
    await openFromScript(page, "w-projects");

    await page.locator('#w-projects a[href="#w-p-versia"]').click();

    await expect(page.locator("#w-p-versia-title")).toBeFocused();
    expect(await ringed(page, "w-p-versia")).toBe(false);

    await page.locator('#w-projects a[href="#w-p-website"]').focus();
    await page.keyboard.press("Enter");

    await expect(page.locator("#w-p-website-title")).toBeFocused();
    expect(await ringed(page, "w-p-website")).toBe(true);
});

for (const [width, height] of [
    [1024, 768],
    [1280, 800],
] as const) {
    test(`at ${width}px wide a window opened after load leaves a grip of README's and Terminal's title bars`, async ({
        page,
    }) => {
        await open(page, width, height);
        await page.locator("#w-readme .window__bar").click();
        await openFromScript(page, "w-projects");

        const projects = await box(page.locator("#w-projects"));
        for (const id of ["w-readme", "w-terminal"]) {
            const bar = await box(page.locator(`#${id} .window__bar`));

            expect(
                barShows(bar, projects),
                `Projects covers the bar of ${id}`,
            ).toBe(true);
        }
    });
}

test("resizing a window past the desk's edge leaves it inside the desk", async ({
    page,
}) => {
    await open(page);

    await page.locator("#w-terminal").evaluate((el) => {
        el.style.width = "2000px";
        el.style.height = "2000px";
    });

    await expect(async () => {
        const desk = await box(page.locator(".desk"));
        const win = await box(page.locator("#w-terminal"));

        expect(win.x + win.width).toBeLessThanOrEqual(
            desk.x + desk.width - MARGIN + 1,
        );
        expect(win.y + win.height).toBeLessThanOrEqual(
            desk.y + desk.height - MARGIN + 1,
        );
    }).toPass();
});

test("a framed body is a group named by its window's path", async ({
    page,
}) => {
    await open(page);

    const body = page.locator("#w-terminal .window__body");

    await expect(body).toHaveAttribute("role", "group");
    await expect(body).toHaveAttribute("aria-labelledby", "w-terminal-path");
    await expect(page.locator("#w-terminal-path")).toHaveText(
        "guest@cpluspatch.com",
    );
});

test("a malformed hash on load still sets up the desk", async ({
    page,
    problems,
}) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/desktop/#%E0%A4%A");
    await expect(page.locator(".desk")).toHaveClass(/window-manager--on/);

    expect(await zIndex(page.locator("#w-readme"))).toBeGreaterThan(
        await zIndex(page.locator("#w-terminal")),
    );
    expect(problems).toEqual([]);
});

test("the close button closes its window", async ({ page }) => {
    await open(page);

    await page.getByRole("button", { name: "Close README" }).click();

    await expect(page.locator("#w-readme")).toBeHidden();
    await expect(page.locator("#w-terminal")).toBeVisible();
});

test("closing with the mouse focuses the next title without a ring, and with a key keeps it", async ({
    page,
}) => {
    await open(page);
    const ringed = (id: string) =>
        page
            .locator(`#${id}-title`)
            .evaluate((el) => el.matches(":focus-visible"));

    await page.getByRole("button", { name: "Close README" }).click();

    await expect(page.locator("#w-terminal-title")).toBeFocused();
    expect(await ringed("w-terminal")).toBe(false);

    await page.locator("#w-terminal .window__close").focus();
    await page.keyboard.press("Enter");

    await expect(page.locator("#w-terminal")).toBeHidden();
    await expect(page.locator(".desk")).toBeFocused();
});

test("Escape closing a window shows the ring on the next title", async ({
    page,
}) => {
    await open(page);

    await page.locator("#w-terminal .window__bar").click();
    await page.keyboard.press("Escape");
    const title = page.locator("#w-readme-title");

    await expect(title).toBeFocused();
    expect(await title.evaluate((el) => el.matches(":focus-visible"))).toBe(
        true,
    );
});

test("dragging a title bar moves the window, and not out of reach", async ({
    page,
}) => {
    await open(page);
    const bar = page.locator("#w-readme .window__bar");
    const before = await box(page.locator("#w-readme"));
    const grab = await box(bar);
    const [x, y] = [grab.x + grab.width / 2, grab.y + grab.height / 2];

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 100, y + 60, { steps: 5 });
    await page.mouse.up();

    const moved = await box(page.locator("#w-readme"));
    expect(moved.x - before.x).toBeCloseTo(100, 0);
    expect(moved.y - before.y).toBeCloseTo(60, 0);

    for (const [toX, toY] of [
        [x + 4000, y + 4000],
        [x - 4000, y - 4000],
    ]) {
        const from = await box(bar);
        await page.mouse.move(
            from.x + from.width / 2,
            from.y + from.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(toX, toY, { steps: 5 });
        await page.mouse.up();

        await reachable(page, "w-readme");
    }
});

/** Drags a window's title bar by an offset. */
const drag = async (page: Page, id: string, dx: number, dy: number) => {
    const bar = await box(page.locator(`#${id} .window__bar`));
    const [x, y] = [bar.x + bar.width / 2, bar.y + bar.height / 2];

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 5 });
    await page.mouse.up();
};

/** Whether the window is fully on the desk, inside its margins. */
const onDesk = async (page: Page, id: string) => {
    const desk = await box(page.locator(".desk"));
    const win = await box(page.locator(`#${id}`));

    expect(win.x - desk.x, `${id} left`).toBeGreaterThanOrEqual(MARGIN - 1);
    expect(win.y - desk.y, `${id} top`).toBeGreaterThanOrEqual(MARGIN - 1);
    expect(
        desk.x + desk.width - (win.x + win.width),
        `${id} right`,
    ).toBeGreaterThanOrEqual(MARGIN - 1);
    expect(
        desk.y + desk.height - (win.y + win.height),
        `${id} bottom`,
    ).toBeGreaterThanOrEqual(MARGIN - 1);
};

/** Drags Terminal as far down and right as the grip allows. */
const dragAway = async (page: Page) => {
    await drag(page, "w-terminal", 4000, 4000);

    const desk = await box(page.locator(".desk"));
    const win = await box(page.locator("#w-terminal"));
    expect(win.x + win.width).toBeGreaterThan(desk.x + desk.width);
};

test("a link to a window dragged off the desk brings it back inside the margins", async ({
    page,
}) => {
    await open(page);
    await dragAway(page);

    await page.locator("#w-readme .window__bar").click();
    await page.locator('#w-readme a[href="#w-terminal"]').focus();
    await page.keyboard.press("Enter");

    await expect(page.locator("#w-terminal")).toHaveClass(/window--active/);
    await onDesk(page, "w-terminal");
});

test("tabbing into a window dragged off the desk brings it back inside the margins", async ({
    page,
}) => {
    await open(page);
    await dragAway(page);

    // README has a control or two after its last link.
    await page.locator("#w-readme a").last().focus();
    await expect(async () => {
        await page.keyboard.press("Tab");
        expect(
            await page.evaluate(
                () => !!document.activeElement?.closest("#w-terminal"),
            ),
        ).toBe(true);
    }).toPass();

    await expect(page.locator("#w-terminal")).toHaveClass(/window--active/);
    expect(
        await page.evaluate(
            () => !!document.activeElement?.closest("#w-terminal"),
        ),
    ).toBe(true);
    await onDesk(page, "w-terminal");
});

test("a pointer press on a window partly off the desk doesn't move it", async ({
    page,
}) => {
    await open(page);
    await dragAway(page);
    await page.locator("#w-readme .window__bar").click();
    const before = await box(page.locator("#w-terminal"));

    await page.mouse.click(before.x + 20, before.y + 10);

    await expect(page.locator("#w-terminal")).toHaveClass(/window--active/);
    expect(await box(page.locator("#w-terminal"))).toEqual(before);
});

test("a window can't be dragged past the desk's left or top edge, but can go off the right and bottom", async ({
    page,
}) => {
    await open(page);
    const desk = await box(page.locator(".desk"));

    await drag(page, "w-terminal", -4000, -4000);
    const topLeft = await box(page.locator("#w-terminal"));

    // Room for the focus ring: FOCUS_RING in lib/window-layout.ts
    expect(topLeft.x - desk.x).toBeCloseTo(4, 0);
    expect(topLeft.y - desk.y).toBeCloseTo(4, 0);

    await drag(page, "w-terminal", 4000, 4000);
    const bottomRight = await box(page.locator("#w-terminal"));

    expect(bottomRight.x + bottomRight.width).toBeGreaterThan(
        desk.x + desk.width,
    );
    expect(desk.x + desk.width - bottomRight.x).toBeCloseTo(GRIP, 0);
    expect(desk.y + desk.height - bottomRight.y).toBeCloseTo(GRIP, 0);
});

test("shrinking the viewport and growing it back restores every window, after a window was opened and one dragged", async ({
    page,
}) => {
    await open(page, 1280, 800);
    await openFromScript(page, "w-projects");
    await drag(page, "w-terminal", -60, 90);

    const before = await openBoxes(page);
    expect(before.size).toBe(3);

    await page.setViewportSize({ width: 761, height: 480 });

    await expect(async () => {
        const desk = await box(page.locator(".desk"));
        for (const [id, win] of await openBoxes(page)) {
            expect(win.x - desk.x, `${id} left`).toBeGreaterThanOrEqual(
                MARGIN - 1,
            );
            expect(win.y - desk.y, `${id} top`).toBeGreaterThanOrEqual(
                MARGIN - 1,
            );
            expect(
                desk.x + desk.width - (win.x + win.width),
                `${id} right`,
            ).toBeGreaterThanOrEqual(MARGIN - 1);
            expect(
                desk.y + desk.height - (win.y + win.height),
                `${id} bottom`,
            ).toBeGreaterThanOrEqual(MARGIN - 1);
        }
    }).toPass();

    await page.setViewportSize({ width: 1280, height: 800 });

    await expect(async () => {
        const after = await openBoxes(page);
        for (const [id, win] of before) {
            expect(after.get(id), id).toEqual(win);
        }
    }).toPass();
});

test("the pair open at load starts at the margin, so README lines up with the header", async ({
    page,
}) => {
    await open(page, 1280, 800);
    await openAll(page);

    const desk = await box(page.locator(".desk"));
    const readme = await box(page.locator("#w-readme"));
    expect(readme.x - desk.x).toBeCloseTo(MARGIN, 0);
    for (const [id, win] of await openBoxes(page)) {
        expect(win.x, `${id} left`).toBeGreaterThanOrEqual(readme.x - 1);
    }
});

test("at 761px wide the pair open at load isn't narrowed to crop its content", async ({
    page,
}) => {
    await open(page, 761, 800);

    // Three quarters of the 576px they open at: NARROWEST in lib/window-layout.ts
    for (const id of ["w-readme", "w-terminal"]) {
        expect(
            (await box(page.locator(`#${id}`))).width,
            id,
        ).toBeGreaterThanOrEqual(432 - 1);
    }
});

test("shrinking the viewport keeps every window reachable on the desk", async ({
    page,
}) => {
    await open(page);
    await openAll(page);

    await page.setViewportSize({ width: 800, height: 500 });

    // The desk's observer re-clamps a frame or so after the resize.
    await expect(async () => {
        const desk = await box(page.locator(".desk"));
        for (const id of APPS) {
            await reachable(page, id);

            const win = await box(page.locator(`#${id}`));
            expect(win.width, `${id} width`).toBeLessThanOrEqual(
                desk.width + 1,
            );
            expect(win.height, `${id} height`).toBeLessThanOrEqual(
                desk.height + 1,
            );
        }
    }).toPass();
});

test("shrinking the viewport from 1920 to 1024 brings every open window fully into the desk", async ({
    page,
}) => {
    await open(page, 1920, 1080);
    await openAll(page);

    await page.setViewportSize({ width: 1024, height: 768 });

    await expect(async () => {
        const desk = await box(page.locator(".desk"));
        for (const [id, win] of await openBoxes(page)) {
            expect(win.x, `${id} left`).toBeGreaterThanOrEqual(desk.x - 1);
            expect(win.y, `${id} top`).toBeGreaterThanOrEqual(desk.y - 1);
            expect(win.x + win.width, `${id} right`).toBeLessThanOrEqual(
                desk.x + desk.width + 1,
            );
            expect(win.y + win.height, `${id} bottom`).toBeLessThanOrEqual(
                desk.y + desk.height + 1,
            );
        }
    }).toPass();
});

for (const scheme of ["light", "dark"] as const) {
    test(`axe finds no violations on the desktop, ${scheme}`, async ({
        page,
    }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await open(page);
        await openAll(page);

        const { violations } = await new AxeBuilder({ page }).analyze();
        const found = violations
            .map((v) => ({
                id: v.id,
                // The README's heatmap scrolls inside its window, and its
                // scroller isn't focusable. That's the heatmap's, not the
                // window manager's.
                targets: v.nodes
                    .map((n) => JSON.stringify(n.target))
                    .filter(
                        (t) =>
                            v.id !== "scrollable-region-focusable" ||
                            t !== '[".heatmap__scroll"]',
                    ),
            }))
            .filter((v) => v.targets.length)
            .map((v) => `${v.id}: ${v.targets.join(" ")}`);

        expect(found).toEqual([]);
    });
}

test("the desktop logs no errors", async ({ page, problems }) => {
    await open(page);
    await page.waitForTimeout(500);

    expect(problems).toEqual([]);
});
