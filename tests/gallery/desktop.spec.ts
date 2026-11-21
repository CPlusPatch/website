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

/** The taskbar's window buttons. */
const buttons = (page: Page) => page.locator("#taskbar-windows button");

/** The button of one window. */
const buttonOf = (page: Page, id: string) =>
    page.locator(`#taskbar-windows button[data-window="${id}"]`);

/** The titles on the taskbar's window buttons, in order. */
const buttonTitles = (page: Page) =>
    page.locator("#taskbar-windows .taskbar__label").allTextContents();

/** Follows a link to a window, as one on the page does. */
const follow = (page: Page, id: string) =>
    page.evaluate((target) => {
        const link = document.createElement("a");
        link.href = `#${target}`;
        document.body.append(link);
        link.click();
        link.remove();
    }, id);

/** The window's button is last in the list and current, and its title has focus. */
const expectOpenedLast = async (page: Page, id: string) => {
    const titles = await buttons(page).evaluateAll((els) =>
        els.map((el) => (el as HTMLElement).dataset.window),
    );

    expect(titles.at(-1)).toBe(id);
    expect(await currents(page)).toEqual([id]);
    await expect(buttonOf(page, id)).toHaveAttribute("aria-current", "true");
    await expect(page.locator(`#${id}-title`)).toBeFocused();
};

/** The `aria-current` window buttons' windows. */
const currents = (page: Page) =>
    page
        .locator("#taskbar-windows button[aria-current]")
        .evaluateAll((els) =>
            els.map((el) => (el as HTMLElement).dataset.window),
        );

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

    test("the header is at the top with the brand, the home link and the Display menu, and the launcher, window list and desk icons are hidden", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto("/desktop/");

        const bar = page.locator(".desk-bar");
        expect((await box(bar)).y).toBe(0);
        await expect(
            bar.getByRole("heading", { name: "JesseOS", level: 1 }),
        ).toBeVisible();
        await expect(
            bar.getByRole("link", { name: "Back to the site" }),
        ).toBeVisible();
        await expect(
            bar.getByRole("button", { name: "Display" }),
        ).toBeVisible();

        await expect(page.locator(".launcher")).toBeHidden();
        await expect(page.locator("#taskbar-windows")).toBeHidden();
        await expect(page.locator(".desk-icons")).toBeHidden();
        await expect(page.locator(".desk-bar .clock")).toBeHidden();
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
    test(`at ${width}px wide Terminal's title bar keeps a grip clear of README`, async ({
        page,
    }) => {
        await open(page, width, height);

        // README is on top, so only it can cover Terminal's bar. A narrowed
        // desk (see the desk icons) may overlap the pair, with Terminal
        // behind and higher by one step.
        const bar = await box(page.locator("#w-terminal .window__bar"));
        const win = await box(page.locator("#w-readme"));

        expect(
            barShows(bar, win),
            "w-readme covers the bar of w-terminal",
        ).toBe(true);
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

test("opening each closed window in turn leaves no sliver between edges, and each window at least 60% of the desk's width and 55% of its height, or its natural size", async ({
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
        // The height floor is lower: the desk icons' column leaves fewer free
        // spots, so Radio lands lower down.
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
                Math.min(natural.height, 0.55 * desk.height) - 1,
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
    await expect(page.locator(".window__title[aria-describedby]")).toHaveCount(
        APPS.length,
    );
    await expect(status(page)).toHaveCount(1);

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
    await expect(page.locator(".window__title[aria-describedby]")).toHaveCount(
        0,
    );
    await expect(page.locator(".desk > .visually-hidden")).toHaveCount(0);
    await expect(status(page)).toHaveCount(0);
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

/** Presses a key `times` times. */
const press = async (page: Page, key: string, times = 1) => {
    for (let i = 0; i < times; i++) await page.keyboard.press(key);
};

/** The status region the manager adds for screen readers. */
const status = (page: Page) => page.locator('.desk > [role="status"]');

test("the arrow keys on a window's title move it 16px, or 64px with Shift, and keep its size and focus", async ({
    page,
}) => {
    await open(page);
    const title = page.locator("#w-terminal-title");
    await title.focus();
    const before = await box(page.locator("#w-terminal"));

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");

    const moved = await box(page.locator("#w-terminal"));
    expect(moved).toEqual({
        ...before,
        x: before.x + 16,
        y: before.y + 16,
    });

    await page.keyboard.press("Shift+ArrowLeft");

    const shifted = await box(page.locator("#w-terminal"));
    expect(shifted).toEqual({ ...moved, x: moved.x - 64 });
    await expect(title).toBeFocused();
});

test("Ctrl and the arrow keys resize a window from its bottom-right corner, 16px or 64px with Shift", async ({
    page,
}) => {
    await open(page);
    await page.locator("#w-terminal-title").focus();
    const before = await box(page.locator("#w-terminal"));

    await page.keyboard.press("Control+ArrowRight");
    await page.keyboard.press("Control+ArrowUp");

    const resized = await box(page.locator("#w-terminal"));
    expect(resized).toEqual({
        ...before,
        width: before.width + 16,
        height: before.height - 16,
    });

    await page.keyboard.press("Control+Shift+ArrowLeft");

    expect(await box(page.locator("#w-terminal"))).toEqual({
        ...resized,
        width: resized.width - 64,
    });
});

test("holding Ctrl and Left stops at the minimum width, and Ctrl and Right at the desk's far margin", async ({
    page,
}) => {
    await open(page);
    await page.locator("#w-terminal-title").focus();
    const desk = await box(page.locator(".desk"));

    await press(page, "Control+Shift+ArrowLeft", 30);
    await press(page, "Control+Shift+ArrowUp", 30);
    const least = await box(page.locator("#w-terminal"));

    // --window-min-width and --window-min-height in components/window-manager.css
    expect(least.width).toBe(256);
    expect(least.height).toBe(160);

    await press(page, "Control+Shift+ArrowRight", 30);
    await press(page, "Control+Shift+ArrowDown", 30);
    const most = await box(page.locator("#w-terminal"));

    expect(most.x).toBe(least.x);
    expect(most.y).toBe(least.y);
    expect(desk.x + desk.width - (most.x + most.width)).toBeCloseTo(MARGIN, 0);
    expect(desk.y + desk.height - (most.y + most.height)).toBeCloseTo(
        MARGIN,
        0,
    );
});

test("the arrow keys can't move a window past the desk's left or top edge", async ({
    page,
}) => {
    await open(page);
    await page.locator("#w-terminal-title").focus();
    const desk = await box(page.locator(".desk"));

    await press(page, "Shift+ArrowLeft", 30);
    await press(page, "Shift+ArrowUp", 30);

    const win = await box(page.locator("#w-terminal"));
    // Room for the focus ring: FOCUS_RING in lib/window-layout.ts
    expect(win.x - desk.x).toBeCloseTo(4, 0);
    expect(win.y - desk.y).toBeCloseTo(4, 0);
});

test("the arrow keys in a window's scroll body and in the terminal's input don't move it", async ({
    page,
}) => {
    await open(page);

    for (const [id, field] of [
        ["w-readme", "#w-readme .window__body"],
        ["w-terminal", "#w-terminal input"],
    ]) {
        await page.locator(field).focus();
        const before = await box(page.locator(`#${id}`));

        await press(page, "ArrowRight", 2);
        await press(page, "ArrowLeft", 2);
        await press(page, "ArrowDown");
        await press(page, "Control+ArrowRight");

        expect(await box(page.locator(`#${id}`)), id).toEqual(before);
    }
});

test("each key says what it did in the status region, and the title is described by the hint", async ({
    page,
}) => {
    await open(page);
    const title = page.locator("#w-terminal-title");
    const name = (await title.textContent())?.trim() ?? "";
    await title.focus();
    const desk = await box(page.locator(".desk"));
    const win = page.locator("#w-terminal");

    await expect(title).toHaveAccessibleDescription(
        "Arrow keys move the window, with Shift further. Control and the arrow keys resize it. Escape closes it.",
    );
    await expect(status(page)).toHaveText("");

    await page.keyboard.press("ArrowRight");
    let at = await box(win);
    await expect(status(page)).toHaveText(
        `${name} moved to ${Math.round(at.x - desk.x)}, ${Math.round(at.y - desk.y)}`,
    );

    await page.keyboard.press("Control+ArrowDown");
    at = await box(win);
    await expect(status(page)).toHaveText(
        `${name} resized to ${Math.round(at.width)} by ${Math.round(at.height)}`,
    );

    await press(page, "Shift+ArrowLeft", 30);
    await page.keyboard.press("ArrowLeft");
    await expect(status(page)).toHaveText(
        `${name} can't move further that way`,
    );

    // The same text again is cleared first, so it's read again.
    await status(page).evaluate((el) => {
        const seen: string[] = [];
        new MutationObserver(() => seen.push(el.textContent ?? "")).observe(
            el,
            { childList: true, characterData: true, subtree: true },
        );
        Object.assign(window, { seen });
    });
    await page.keyboard.press("ArrowLeft");
    await expect
        .poll(() => page.evaluate(() => Reflect.get(window, "seen")))
        .toEqual(["", `${name} can't move further that way`]);

    await press(page, "Control+Shift+ArrowLeft", 30);
    await page.keyboard.press("Control+ArrowLeft");
    await expect(status(page)).toHaveText(
        `${name} can't resize further that way`,
    );
});

test("a window moved or resized by the keys comes back after the viewport shrinks and grows again", async ({
    page,
}) => {
    await open(page, 1280, 800);
    const start = await box(page.locator("#w-terminal"));
    await page.locator("#w-terminal-title").focus();
    await press(page, "Shift+ArrowRight");
    await press(page, "Shift+ArrowDown", 2);
    await press(page, "Control+ArrowRight", 3);
    const before = await box(page.locator("#w-terminal"));
    expect(before).not.toEqual(start);

    await page.setViewportSize({ width: 761, height: 480 });

    await expect(async () => {
        const desk = await box(page.locator(".desk"));
        const win = await box(page.locator("#w-terminal"));
        expect(win.x + win.width).toBeLessThan(before.x + before.width);
        expect(
            desk.x + desk.width - (win.x + win.width),
        ).toBeGreaterThanOrEqual(MARGIN - 1);
    }).toPass();

    await page.setViewportSize({ width: 1280, height: 800 });

    await expect(async () => {
        expect(await box(page.locator("#w-terminal"))).toEqual(before);
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

test("with the manager on, the taskbar ends at the bottom of the viewport, the desk ends where it begins, and the title is hidden but still a heading", async ({
    page,
}) => {
    await open(page, 1280, 800);

    const bar = await box(page.locator(".desk-bar"));
    const desk = await box(page.locator(".desk"));
    expect(bar.y + bar.height).toBeCloseTo(800, 0);
    expect(desk.y + desk.height).toBeCloseTo(bar.y, 0);

    const heading = page.getByRole("heading", { name: "JesseOS", level: 1 });
    await expect(heading).toHaveCount(1);
    const title = await box(heading);
    expect(title.width).toBeLessThanOrEqual(1);
    expect(title.height).toBeLessThanOrEqual(1);
});

test("every app has a launcher link and a desk icon, naming its window with its title, in the page's order", async ({
    page,
}) => {
    await open(page);

    const apps = await windows(page).evaluateAll((els) =>
        els
            .filter((el) => !el.id.startsWith("w-p-"))
            .map((el) => ({
                href: `#${el.id}`,
                title: el.querySelector(".window__title")?.textContent?.trim(),
            })),
    );
    const links = (selector: string) =>
        page.locator(selector).evaluateAll((els) =>
            els.map((el) => ({
                href: el.getAttribute("href"),
                title: el.textContent?.trim(),
            })),
        );

    expect(await links(".launcher__link")).toEqual(apps);
    expect(await links(".desk-icons__link")).toEqual(apps);
});

test("at load the window list holds README then Terminal, and README's button alone is current", async ({
    page,
}) => {
    await open(page);

    await expect(buttons(page)).toHaveCount(2);
    expect(await buttonTitles(page)).toEqual(["README", "Terminal"]);
    expect(await currents(page)).toEqual(["w-readme"]);
});

test("opening a window adds its button last and makes it current, and closing removes it and passes that to the new top window", async ({
    page,
}) => {
    await open(page);

    await follow(page, "w-chat");

    await expect(buttons(page)).toHaveCount(3);
    expect(await buttonTitles(page)).toEqual(["README", "Terminal", "Chat"]);
    expect(await currents(page)).toEqual(["w-chat"]);

    await page.locator("#w-chat .window__close").click();

    await expect(buttons(page)).toHaveCount(2);
    expect(await buttonTitles(page)).toEqual(["README", "Terminal"]);
    expect(await currents(page)).toEqual(["w-readme"]);
});

test("pressing the top window's button minimises it, keeping its button and place, and pressing it again restores it on top", async ({
    page,
}) => {
    await open(page);
    const before = await box(page.locator("#w-readme"));
    const button = buttonOf(page, "w-readme");

    await button.click();

    await expect(page.locator("#w-readme")).toBeHidden();
    await expect(button).toHaveClass(/taskbar__item--minimised/);
    await expect(button).toHaveAccessibleName("README (minimised)");
    await expect(buttons(page)).toHaveCount(2);
    expect(await currents(page)).toEqual(["w-terminal"]);
    await expect(button).toBeFocused();

    await button.click();

    await expect(page.locator("#w-readme")).toBeVisible();
    await expect(button).not.toHaveClass(/taskbar__item--minimised/);
    await expect(button).toHaveAccessibleName("README");
    expect(await box(page.locator("#w-readme"))).toEqual(before);
    expect(await currents(page)).toEqual(["w-readme"]);
    expect(await zIndex(page.locator("#w-readme"))).toBeGreaterThan(
        await zIndex(page.locator("#w-terminal")),
    );
    await expect(page.locator("#w-readme-title")).toBeFocused();
});

test("pressing the button of a window that isn't on top raises it and focuses its title", async ({
    page,
}) => {
    await open(page);

    await buttonOf(page, "w-terminal").click();

    expect(await currents(page)).toEqual(["w-terminal"]);
    await expect(page.locator("#w-terminal")).toHaveClass(/window--active/);
    expect(await zIndex(page.locator("#w-terminal"))).toBeGreaterThan(
        await zIndex(page.locator("#w-readme")),
    );
    await expect(page.locator("#w-terminal-title")).toBeFocused();
});

test("a link to a minimised window restores it where it was", async ({
    page,
}) => {
    await open(page);
    const before = await box(page.locator("#w-readme"));
    await buttonOf(page, "w-readme").click();
    await expect(page.locator("#w-readme")).toBeHidden();

    await follow(page, "w-readme");

    await expect(page.locator("#w-readme")).toBeVisible();
    expect(await box(page.locator("#w-readme"))).toEqual(before);
    await expect(buttonOf(page, "w-readme")).not.toHaveClass(
        /taskbar__item--minimised/,
    );
    expect(await currents(page)).toEqual(["w-readme"]);
});

test("choosing a launcher item opens its window and closes the menu, and Escape closes the menu but no window", async ({
    page,
}) => {
    await open(page);
    const trigger = page.locator(".launcher__trigger");
    const panel = page.locator("#launcher");

    await expect(panel).toBeHidden();
    await trigger.click();
    await expect(panel).toBeVisible();
    await panel.getByRole("link", { name: "Chat" }).click();

    await expect(page.locator("#w-chat")).toBeVisible();
    await expect(panel).toBeHidden();
    await expectOpenedLast(page, "w-chat");

    await trigger.click();
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(panel).toBeHidden();
    expect(await openIds(page)).toEqual(["w-readme", "w-terminal", "w-chat"]);
});

test("a desk icon opens its window", async ({ page }) => {
    await open(page);
    await expect(page.locator("#w-toys")).toBeHidden();

    await page.locator('.desk-icons__link[href="#w-toys"]').click();

    await expect(page.locator("#w-toys")).toBeVisible();
    await expectOpenedLast(page, "w-toys");
});

test("the desk icons are at the desk's right edge, and no window open at load covers one", async ({
    page,
}) => {
    await open(page, 1280, 800);

    const desk = await box(page.locator(".desk"));
    const icons = await page.locator(".desk-icons__link").evaluateAll((els) =>
        els.map((el) => {
            const { x, y, width, height } = el.getBoundingClientRect();
            return { x, y, width, height };
        }),
    );
    expect(icons).toHaveLength(8);

    for (const icon of icons) {
        // The column's right edge is the window margin from the desk's.
        expect(
            Math.abs(desk.x + desk.width - (icon.x + icon.width) - MARGIN),
        ).toBeLessThanOrEqual(1);
        expect(icon.y + icon.height).toBeLessThanOrEqual(
            desk.y + desk.height + 1,
        );
        for (const id of ["w-readme", "w-terminal"]) {
            const win = await box(page.locator(`#${id}`));
            expect(icon.x, `${id} covers an icon`).toBeGreaterThanOrEqual(
                win.x + win.width - 1,
            );
        }
    }
});

for (const [width, height] of [
    [1280, 800],
    [1024, 768],
    [800, 600],
] as const) {
    test(`at ${width} by ${height} no window placed at load or opened from the launcher covers a desk icon`, async ({
        page,
    }) => {
        await open(page, width, height);

        const covered = async (when: string) => {
            const column = await box(page.locator(".desk-icons"));
            for (const id of await openIds(page)) {
                const win = await box(page.locator(`#${id}`));
                const overlaps =
                    win.x < column.x + column.width &&
                    column.x < win.x + win.width &&
                    win.y < column.y + column.height &&
                    column.y < win.y + win.height;

                expect(overlaps, `${when}: ${id} covers the desk icons`).toBe(
                    false,
                );
            }
        };

        await covered("at load");
        for (const app of APPS.filter((id) => !id.startsWith("w-p-"))) {
            await page.locator(".launcher__trigger").click();
            await page.locator(`#launcher a[href="#${app}"]`).click();
            await expect(page.locator(`#${app}`)).toBeVisible();
            await covered(`after ${app}`);
        }
    });
}

test("a window dragged, minimised, restored after a smaller desk, and the desk grown back, is where the same drag without minimising puts it", async ({
    page,
}) => {
    const sizes = [
        { width: 900, height: 700 },
        { width: 1280, height: 800 },
    ];
    const boxes = async (minimise: boolean) => {
        await open(page, 1280, 800);
        await drag(page, "w-readme", -10, 60);
        if (minimise) {
            await buttonOf(page, "w-readme").click();
            await expect(page.locator("#w-readme")).toBeHidden();
        }

        const found: Awaited<ReturnType<typeof box>>[] = [];
        for (const size of sizes) {
            await page.setViewportSize(size);
            if (minimise && size === sizes[0]) {
                await buttonOf(page, "w-readme").click();
            }
            await expect(page.locator("#w-readme")).toBeVisible();
            // Let the desk's resize settle before reading the box.
            await expect(async () => {
                const desk = await box(page.locator(".desk"));
                expect(desk.width).toBe(size.width);
            }).toPass();
            found.push(await box(page.locator("#w-readme")));
        }

        return found;
    };

    const without = await boxes(false);
    const minimised = await boxes(true);

    expect(minimised).toEqual(without);
});

test("the Display menu and the launcher open above the taskbar, in the viewport, and both end a whole 4px above its top edge", async ({
    page,
}) => {
    await open(page, 1280, 800);
    const bar = await box(page.locator(".desk-bar"));

    const bottoms: number[] = [];
    for (const [trigger, panel] of [
        [".desk-bar .dropdown__trigger", "#display"],
        [".launcher__trigger", "#launcher"],
    ] as const) {
        await page.locator(trigger).click();
        await expect(page.locator(panel)).toBeVisible();

        const found = await box(page.locator(panel));
        expect(found.x, panel).toBeGreaterThanOrEqual(0);
        expect(found.y, panel).toBeGreaterThanOrEqual(0);
        expect(found.x + found.width, panel).toBeLessThanOrEqual(1280);
        bottoms.push(found.y + found.height);

        await page.keyboard.press("Escape");
        await expect(page.locator(panel)).toBeHidden();
    }

    // --space-xs is 4px.
    expect(bottoms[0]).toBeCloseTo(bar.y - 4, 0);
    expect(Number.isInteger(bottoms[0])).toBe(true);
    expect(bottoms[1]).toBe(bottoms[0]);
});

test("with five windows open at 800 by 600, every taskbar button has the window's title and name, and its label either fits or gives way to the icon", async ({
    page,
}) => {
    await open(page, 800, 600);
    for (const id of ["w-projects", "w-monitor", "w-letters"]) {
        await follow(page, id);
    }
    await expect(buttons(page)).toHaveCount(5);

    const found = await buttons(page).evaluateAll((els) =>
        els.map((el) => {
            const label = el.querySelector<HTMLElement>(".taskbar__label");
            const icon = el.querySelector(".taskbar__icon");
            const shown = label
                ? label.getBoundingClientRect().width > 1
                : false;
            return {
                title: el.getAttribute("title"),
                text: label?.textContent?.trim(),
                shown,
                fits: !!label && label.scrollWidth <= label.clientWidth,
                icon: !!icon && icon.getBoundingClientRect().width > 0,
            };
        }),
    );

    expect(found.map((one) => one.text)).toEqual([
        "README",
        "Terminal",
        "Projects",
        "Monitor",
        "Letters",
    ]);
    for (const one of found) {
        expect(one.title).toBe(one.text);
        expect(one.shown ? one.fits : one.icon, one.text).toBe(true);
    }
    for (const title of ["README", "Terminal", "Letters"]) {
        await expect(
            page.locator(`#taskbar-windows button[title="${title}"]`),
        ).toHaveAccessibleName(new RegExp(title));
    }
});

/** Opens the eight apps (not the project viewers), so the taskbar holds eight buttons. */
const openApps = async (page: Page) => {
    const apps = [
        "w-readme",
        "w-terminal",
        "w-projects",
        "w-monitor",
        "w-letters",
        "w-radio",
        "w-chat",
        "w-toys",
    ];

    for (const id of apps) {
        await follow(page, id);
    }
    await expect(buttons(page)).toHaveCount(apps.length);

    return apps;
};

test("with all eight windows open at 1280 by 800, every taskbar label is shown, and at 800 by 600 they are icon-only", async ({
    page,
}) => {
    const shown = () =>
        buttons(page).evaluateAll((els) =>
            els.map(
                (el) =>
                    (
                        el.querySelector(".taskbar__label") as HTMLElement
                    ).getBoundingClientRect().width > 1,
            ),
        );

    await open(page, 1280, 800);
    const apps = await openApps(page);
    expect(await shown()).toEqual(apps.map(() => true));

    await open(page, 800, 600);
    await openApps(page);
    expect(await shown()).toEqual(apps.map(() => false));
});

test("in forced colours only the active window button has a rule, and an inactive one's matches the bar", async ({
    page,
}) => {
    await page.emulateMedia({ forcedColors: "active" });
    await open(page, 1280, 800);

    const rule = (selector: string) =>
        page
            .locator(selector)
            .evaluate((el) => getComputedStyle(el).borderBottomColor);
    const active = await rule("#taskbar-windows button[aria-current]");
    const inactive = await rule("#taskbar-windows button:not([aria-current])");
    const bar = await page
        .locator(".desk-bar")
        .evaluate((el) => getComputedStyle(el).backgroundColor);

    expect(active).not.toBe(inactive);
    expect(inactive).toBe(bar);
});

test("a minimised window's button has a dashed outline, and on hover it takes the text colour", async ({
    page,
}) => {
    await open(page, 1280, 800);
    await buttonOf(page, "w-readme").click();

    const button = buttonOf(page, "w-readme");
    const colour = (locator: Locator) =>
        locator.evaluate((el) => getComputedStyle(el).color);
    await expect(button).toHaveClass(/taskbar__item--minimised/);
    expect(
        await button.evaluate((el) => getComputedStyle(el).outlineStyle),
    ).toBe("dashed");

    // The click left the pointer on the button.
    await page.mouse.move(640, 300);
    const muted = await colour(button);
    const text = await colour(buttonOf(page, "w-terminal"));
    expect(muted).not.toBe(text);

    await button.hover();
    expect(await colour(button)).toBe(text);
});

test("Back to the site has a tooltip and, in the taskbar, a window button's box and hover fill", async ({
    page,
}) => {
    await open(page, 1280, 800);

    const home = page.locator(".desk-bar__home");
    await expect(home).toHaveAttribute("title", "Back to the site");

    const style = (locator: Locator) =>
        locator.evaluate((el) => {
            const css = getComputedStyle(el);
            return {
                height: el.getBoundingClientRect().height,
                padding: css.paddingLeft,
                background: css.backgroundColor,
            };
        });
    const button = await style(buttonOf(page, "w-terminal"));
    const rest = await style(home);

    // Both stretch to the bar.
    expect(rest.height).toBe(button.height);
    expect(rest.padding).toBe(button.padding);

    await buttonOf(page, "w-terminal").hover();
    const hovered = (await style(buttonOf(page, "w-terminal"))).background;
    await home.hover();
    expect((await style(home)).background).toBe(hovered);
    expect(hovered).not.toBe(button.background);
});

test("the Apps button keeps a fill while its menu is open and the pointer is elsewhere", async ({
    page,
}) => {
    await open(page, 1280, 800);

    const trigger = page.locator(".launcher__trigger");
    const fill = () =>
        trigger.evaluate((el) => getComputedStyle(el).backgroundColor);
    const closed = await fill();

    await trigger.click();
    await expect(page.locator("#launcher")).toBeVisible();
    await page.mouse.move(640, 300);

    expect(await fill()).not.toBe(closed);
});

test("a desk icon's focus ring sits inside the column's box, so it isn't clipped", async ({
    page,
}) => {
    await open(page, 1280, 800);

    const link = page.locator(".desk-icons__link").first();
    await link.focus();
    await expect(link).toBeFocused();

    const column = await box(page.locator(".desk-icons"));
    const found = await box(link);
    // The ring is 2px wide, on the link's edge.
    const ring = 2;

    expect(found.x - ring).toBeGreaterThanOrEqual(column.x);
    expect(found.y - ring).toBeGreaterThanOrEqual(column.y);
    expect(found.x + found.width + ring).toBeLessThanOrEqual(
        column.x + column.width,
    );
    expect(
        await link.evaluate((el) => getComputedStyle(el).outlineOffset),
    ).toBe("0px");
});

test("if the script never runs after the head script adds html.wm, the desk keeps the plain column", async ({
    page,
}) => {
    await page.route("**/_astro/*.js", (route) => route.abort());
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/desktop/");

    await expect(page.locator("html")).toHaveClass(/wm/);
    await expect(page.locator(".desk")).not.toHaveClass(/window-manager--on/);

    // 46rem, centred.
    const desk = await box(page.locator(".desk"));

    expect(desk.width).toBe(736);
    expect(desk.x).toBe((1280 - 736) / 2);
});

test("Back to the site has a hit area at least 44px tall, in the taskbar and in the plain view", async ({
    page,
}) => {
    for (const width of [1280, 700]) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto("/desktop/");
        if (width > 760) {
            await expect(page.locator(".desk-bar")).toHaveClass(/taskbar--on/);
        }

        const home = page.locator(".desk-bar__home");
        const found = await box(home);
        const centre = found.y + found.height / 2;

        for (const offset of [-20, 20]) {
            const hit = await page.evaluate(
                ({ x, y }) =>
                    document
                        .elementFromPoint(x, y)
                        ?.closest(".desk-bar__home") !== null,
                { x: found.x + found.width / 2, y: centre + offset },
            );
            expect(hit, `${width}px wide, ${offset}px from the centre`).toBe(
                true,
            );
        }
    }
});

test("the taskbar turning off closes an open launcher menu", async ({
    page,
}) => {
    await open(page);
    await page.locator(".launcher__trigger").click();
    await expect(page.locator("#launcher")).toBeVisible();

    await page.setViewportSize({ width: 700, height: 900 });

    await expect(page.locator(".desk-bar")).not.toHaveClass(/taskbar--on/);
    await expect(page.locator(".launcher__panel:popover-open")).toHaveCount(0);
    await expect(page.locator("#launcher")).toBeHidden();
});

test("crossing below 760px turns the taskbar off and back on, with a button for each window open at load", async ({
    page,
}) => {
    await open(page);
    await expect(buttons(page)).toHaveCount(2);

    await page.setViewportSize({ width: 700, height: 900 });

    await expect(page.locator(".desk-bar")).not.toHaveClass(/taskbar--on/);
    expect((await box(page.locator(".desk-bar"))).y).toBe(0);
    await expect(page.locator("#taskbar-windows")).toBeHidden();
    await expect(buttons(page)).toHaveCount(0);
    await expect(page.locator(".launcher")).toBeHidden();
    await expect(page.locator(".desk-icons")).toBeHidden();
    await expect(page.getByRole("heading", { name: "JesseOS" })).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 800 });

    await expect(page.locator(".desk-bar")).toHaveClass(/taskbar--on/);
    await expect(buttons(page)).toHaveCount(2);
    expect(await buttonTitles(page)).toEqual(["README", "Terminal"]);
    const bar = await box(page.locator(".desk-bar"));
    expect(bar.y + bar.height).toBeCloseTo(800, 0);
});

test("Back to the site's focus ring in the taskbar sits inside the viewport and the bar", async ({
    page,
}) => {
    await open(page, 1280, 800);
    await page.locator(".desk-bar__home").focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");

    const home = page.locator(".desk-bar__home");
    await expect(home).toBeFocused();

    const ring = await home.evaluate((el) => {
        const css = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const offset = Number.parseFloat(css.outlineOffset);
        return {
            top: rect.top - offset,
            bottom: rect.bottom + offset,
            offset,
            style: css.outlineStyle,
        };
    });
    const bar = await box(page.locator(".desk-bar"));

    expect(ring.style).toBe("solid");
    expect(ring.offset).toBe(-5);
    expect(ring.top).toBeGreaterThanOrEqual(bar.y);
    expect(ring.bottom).toBeLessThanOrEqual(bar.y + bar.height);
    expect(ring.bottom).toBeLessThanOrEqual(800);
});

test("Back to the site is underlined in the plain header and not in the taskbar", async ({
    page,
}) => {
    const line = () =>
        page
            .locator(".desk-bar__home")
            .evaluate((el) => getComputedStyle(el).textDecorationLine);

    await open(page, 1280, 800);
    expect(await line()).toBe("none");

    await page.setViewportSize({ width: 700, height: 900 });
    await expect(page.locator(".desk-bar")).not.toHaveClass(/taskbar--on/);
    expect(await line()).toBe("underline");
});

test("the Apps button's label keeps the text colour while its menu is open", async ({
    page,
}) => {
    await open(page, 1280, 800);

    const trigger = page.locator(".launcher__trigger");
    const colour = () => trigger.evaluate((el) => getComputedStyle(el).color);
    const text = await buttonOf(page, "w-terminal").evaluate(
        (el) => getComputedStyle(el).color,
    );
    expect(await colour()).not.toBe(text);

    await trigger.click();
    await expect(page.locator("#launcher")).toBeVisible();
    await page.mouse.move(640, 300);

    expect(await colour()).toBe(text);
});

test("in forced colours a hovered launcher link is outlined and the open Apps button has a Highlight border", async ({
    page,
}) => {
    await page.emulateMedia({ forcedColors: "active" });
    await open(page, 1280, 800);

    const trigger = page.locator(".launcher__trigger");
    const border = () =>
        trigger.evaluate((el) => getComputedStyle(el).borderTopColor);
    const closed = await border();

    await trigger.click();
    await expect(page.locator("#launcher")).toBeVisible();
    await page.mouse.move(640, 300);
    expect(await border()).not.toBe(closed);

    const link = page.locator(".launcher__link").nth(2);
    await link.hover();
    const outline = await link.evaluate((el) => {
        const css = getComputedStyle(el);
        return { style: css.outlineStyle, offset: css.outlineOffset };
    });
    expect(outline).toEqual({ style: "solid", offset: "-1px" });
});

test("a minimised button's dashed outline is inset from the bar's top border, and a focused one keeps its solid ring", async ({
    page,
}) => {
    await open(page, 1280, 800);
    await buttonOf(page, "w-readme").click();

    const button = buttonOf(page, "w-readme");
    const offset = () =>
        button.evaluate((el) => getComputedStyle(el).outlineOffset);
    await expect(button).toHaveClass(/taskbar__item--minimised/);
    expect(await offset()).toBe("-4px");

    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(button).toBeFocused();
    expect(
        await button.evaluate((el) => getComputedStyle(el).outlineStyle),
    ).toBe("solid");
    expect(await offset()).toBe("-5px");
});

test("a focused active button's ring ends 3px or more above its bottom, so the active rule shows", async ({
    page,
}) => {
    await open(page, 1280, 800);

    const button = buttonOf(page, "w-readme");
    await expect(button).toHaveAttribute("aria-current", "true");
    // A key press first, so the script's focus counts as keyboard focus.
    await page.keyboard.press("Tab");
    await button.focus();
    await expect(button).toBeFocused();

    const gap = await button.evaluate((el) => {
        const css = getComputedStyle(el);
        const offset = Number.parseFloat(css.outlineOffset);
        const width = Number.parseFloat(css.outlineWidth);

        return { outer: -offset - width, solid: css.outlineStyle };
    });

    expect(gap.solid).toBe("solid");
    expect(gap.outer).toBeGreaterThanOrEqual(3);
});

test("with the last of thirteen windows on top, narrowing the window shrinks the list but keeps the active button in it", async ({
    page,
}) => {
    await open(page, 1280, 800);
    await openAll(page);
    await expect(buttons(page)).toHaveCount(APPS.length);

    await page.setViewportSize({ width: 800, height: 600 });

    await expect.poll(() => spill(page)).toBeLessThan(1);
});

/** Opens one app from the launcher. */
const launch = async (page: Page, index: number) => {
    await page.locator(".launcher__trigger").click();
    await page.locator(".launcher__link").nth(index).click();
    await expect(page.locator("#launcher")).toBeHidden();
};

/** How far the current button lies outside the window list's visible box, in px. */
const spill = (page: Page) =>
    page.evaluate(() => {
        const list = document.querySelector("#taskbar-windows");
        const current = list?.querySelector("[aria-current]");
        if (!list || !current) return null;

        const bounds = list.getBoundingClientRect();
        const rect = current.getBoundingClientRect();
        return Math.max(bounds.left - rect.left, rect.right - bounds.right, 0);
    });

test("at 800 by 600 with every app opened from the launcher, the current button is fully inside the window list", async ({
    page,
}) => {
    await open(page, 800, 600);

    for (let index = 0; index < 8; index++) {
        await launch(page, index);
        if (index > 1) expect(await spill(page), `app ${index}`).toBe(0);
    }

    expect(await spill(page)).toBe(0);
});

test("with all thirteen windows open at 760 by 700, the list scrolls and the current button is visible", async ({
    page,
}) => {
    await open(page, 760, 700);
    await openAll(page);
    await expect(buttons(page)).toHaveCount(APPS.length);

    const list = page.locator("#taskbar-windows");
    const scrolls = await list.evaluate(
        (el) => el.scrollWidth > el.clientWidth,
    );
    expect(scrolls).toBe(true);
    expect(await spill(page)).toBeLessThan(1);

    await follow(page, "w-readme");
    await expect(buttonOf(page, "w-readme")).toHaveAttribute(
        "aria-current",
        "true",
    );
    expect(await spill(page)).toBeLessThan(1);
});

test("a crowded window list fades the edge with more buttons past it, and a list that fits fades nothing", async ({
    page,
}) => {
    await open(page, 760, 700);

    const fades = () =>
        page.locator("#taskbar-windows").evaluate((el) => {
            const css = getComputedStyle(el);
            return {
                start: Number.parseFloat(
                    css.getPropertyValue("--taskbar-fade-start"),
                ),
                end: Number.parseFloat(
                    css.getPropertyValue("--taskbar-fade-end"),
                ),
            };
        });
    expect(await fades()).toEqual({ start: 0, end: 0 });

    await openAll(page);
    // The newest button is last, so the list is scrolled to its end.
    const atEnd = await fades();
    // The keyframes read --taskbar-fade, one button and a gap wide.
    expect(atEnd.start).toBe(48);
    expect(atEnd.end).toBe(0);

    await page.locator("#taskbar-windows").evaluate((el) => {
        el.scrollLeft = 0;
    });
    await expect.poll(fades).toMatchObject({ start: 0 });
    expect((await fades()).end).toBe(48);
});

test("at 800 by 600 with every window open, part of a button's icon or label is under the fade at each end of the list", async ({
    page,
}) => {
    await open(page, 800, 600);
    await openAll(page);
    await expect(buttons(page)).toHaveCount(APPS.length);

    const fade = await fadeWidth(page);
    const list = page.locator("#taskbar-windows");
    // Icons and labels only: a button's padding under the fade is no cue.
    const covered = (edge: "left" | "right") =>
        list.evaluate(
            (el, [side, width]) => {
                const bounds = el.getBoundingClientRect();
                const strip =
                    side === "left"
                        ? { from: bounds.left, to: bounds.left + Number(width) }
                        : {
                              from: bounds.right - Number(width),
                              to: bounds.right,
                          };

                return [
                    ...el.querySelectorAll(".taskbar__icon, .taskbar__label"),
                ].some((part) => {
                    const rect = part.getBoundingClientRect();
                    if (!rect.width) return false;
                    return rect.right > strip.from && rect.left < strip.to;
                });
            },
            [edge, fade],
        );

    await list.evaluate((el) => {
        el.scrollLeft = 0;
    });
    expect(await covered("right"), "right edge at scrollLeft 0").toBe(true);

    await list.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
    });
    expect(await covered("left"), "left edge at the max").toBe(true);
});

test("the active window button's rule is a bar that stays straight, and forced colours swap it for a border", async ({
    page,
}) => {
    await open(page, 1280, 800);

    const rule = () =>
        buttonOf(page, "w-readme").evaluate((el) => {
            const css = getComputedStyle(el, "::after");
            return {
                height: css.height,
                display: css.display,
                shadow: getComputedStyle(el).boxShadow,
            };
        });
    expect(await rule()).toEqual({
        height: "3px",
        display: "block",
        shadow: "none",
    });

    await page.emulateMedia({ forcedColors: "active" });
    expect((await rule()).display).toBe("none");
});

test("with every window open the project windows' buttons have different icons", async ({
    page,
}) => {
    await open(page, 1280, 800);
    await openAll(page);

    const icons = await buttons(page).evaluateAll((els) =>
        els.map((el) => el.querySelector(".taskbar__icon")?.innerHTML ?? ""),
    );

    expect(icons).toHaveLength(APPS.length);
    expect(new Set(icons).size).toBe(icons.length);
});

test("closing every window hides the empty list from assistive tech and leaves the tray where it was", async ({
    page,
}) => {
    await open(page, 1280, 800);

    const tray = page.locator(".taskbar__tray");
    const before = await box(tray);

    for (const id of ["w-readme", "w-terminal"]) {
        await page.locator(`#${id} .window__close`).click();
    }
    await expect(buttons(page)).toHaveCount(0);

    const list = page.locator("#taskbar-windows");
    await expect(list).toBeHidden();
    await expect(page.getByRole("list", { name: "Open windows" })).toHaveCount(
        0,
    );
    const after = await box(tray);
    expect(after.x + after.width).toBeCloseTo(before.x + before.width, 0);

    await follow(page, "w-readme");
    await expect(list).toBeVisible();
    await expect(page.getByRole("list", { name: "Open windows" })).toHaveCount(
        1,
    );
});

for (const scheme of ["light", "dark"] as const) {
    test(`axe finds no violations on the desktop, ${scheme}`, async ({
        page,
    }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await open(page);
        await openAll(page);

        const found = async () => {
            const { violations } = await new AxeBuilder({ page }).analyze();
            return violations
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
        };

        expect(await found(), "launcher closed").toEqual([]);

        await page.locator(".launcher__trigger").click();
        await expect(page.locator("#launcher")).toBeVisible();

        expect(await found(), "launcher open").toEqual([]);
    });
}

test("the desktop logs no errors", async ({ page, problems }) => {
    await open(page);
    await page.locator(".launcher__trigger").click();
    await expect(page.locator("#launcher")).toBeVisible();
    await page.waitForTimeout(500);

    expect(problems).toEqual([]);
});

/** The width of the window list's edge fades, in px. */
const fadeWidth = (page: Page) =>
    page.locator("#taskbar-windows").evaluate((list) => {
        const probe = document.createElement("div");
        probe.style.inlineSize = "var(--taskbar-fade)";
        // The list is a flex row, which would shrink it.
        probe.style.flex = "none";
        list.append(probe);
        const width = probe.offsetWidth;
        probe.remove();

        return width;
    });

test("tabbing through a crowded window list keeps each focused button inside the list, and half of it clear of the edge fades", async ({
    page,
}) => {
    await open(page, 800, 600);
    await openAll(page);
    await expect(buttons(page)).toHaveCount(APPS.length);

    const fade = await fadeWidth(page);
    expect(fade).toBe(48);

    const clear = async (id: string | undefined) => {
        const found = await page.evaluate((width) => {
            const list = document.querySelector("#taskbar-windows");
            const focused = document.activeElement;
            if (!list || !focused) return null;

            const bounds = list.getBoundingClientRect();
            const rect = focused.getBoundingClientRect();

            // The fade at an end the list is scrolled to is 0, so a button
            // can touch that edge.
            const room = list.scrollWidth - list.clientWidth;
            const start = list.scrollLeft <= 0 ? 0 : width;
            const end = list.scrollLeft >= room - 1 ? 0 : width;

            return {
                id: (focused as HTMLElement).dataset.window,
                inside:
                    rect.left >= bounds.left - 1 &&
                    rect.right <= bounds.right + 1,
                clear:
                    Math.min(rect.right, bounds.right - end) -
                    Math.max(rect.left, bounds.left + start),
                width: rect.width,
            };
        }, fade);

        expect(found?.id).toBe(id);
        expect(found?.inside, `${id} inside`).toBe(true);
        // The browser scrolls a focused button into view only when it's cut
        // off, so one may sit partly under the fade.
        expect(found?.clear ?? 0, `${id} clear`).toBeGreaterThanOrEqual(
            (found?.width ?? 0) / 2,
        );
    };

    await page.locator(".launcher__trigger").focus();
    for (const id of APPS) {
        await page.keyboard.press("Tab");
        await clear(id);
    }

    for (const id of APPS.slice(0, -1).reverse()) {
        await page.keyboard.press("Shift+Tab");
        await clear(id);
    }
});

test("a vertical wheel over a crowded window list scrolls it sideways, and a list that fits is left alone", async ({
    page,
}) => {
    await open(page, 800, 600);

    const list = page.locator("#taskbar-windows");
    const left = () => list.evaluate((el) => el.scrollLeft);
    const wheel = async () => {
        const found = await box(list);
        await page.mouse.move(
            found.x + found.width / 2,
            found.y + found.height / 2,
        );
        await page.mouse.wheel(0, 200);
    };

    // Two windows fit: the page's wheel is not taken.
    await wheel();
    expect(await left()).toBe(0);

    await openAll(page);
    await list.evaluate((el) => {
        el.scrollLeft = 0;
    });
    await wheel();
    await expect.poll(left).toBeGreaterThan(0);

    // At the end it scrolls toward, the event isn't cancelled.
    const cancelled = await list.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
        const event = new WheelEvent("wheel", {
            deltaY: 100,
            cancelable: true,
            bubbles: true,
        });
        el.dispatchEvent(event);

        return event.defaultPrevented;
    });
    expect(cancelled).toBe(false);

    // And at the start, for the way back.
    const cancelledUp = await list.evaluate((el) => {
        el.scrollLeft = 0;
        const event = new WheelEvent("wheel", {
            deltaY: -100,
            cancelable: true,
            bubbles: true,
        });
        el.dispatchEvent(event);

        return event.defaultPrevented;
    });
    expect(cancelledUp).toBe(false);
});

test("at 760 by 700 the Display menu stops 16px below the top of the viewport and above the bar", async ({
    page,
}) => {
    await open(page, 760, 700);
    const bar = await box(page.locator(".desk-bar"));

    await page.locator(".desk-bar .dropdown__trigger").click();
    await expect(page.locator("#display")).toBeVisible();

    const found = await box(page.locator("#display"));
    expect(found.y).toBeCloseTo(16, 0);
    expect(found.y + found.height).toBeLessThanOrEqual(bar.y);
});

test("in forced colours a hovered desk icon is outlined, and a focused one keeps its ring", async ({
    page,
}) => {
    await page.emulateMedia({ forcedColors: "active" });
    await open(page, 1280, 800);

    const link = page.locator(".desk-icons__link").nth(2);
    const outline = () =>
        link.evaluate((el) => {
            const css = getComputedStyle(el);
            return { style: css.outlineStyle, offset: css.outlineOffset };
        });

    await link.hover();
    expect(await outline()).toEqual({ style: "solid", offset: "-1px" });

    // Focused by key while still hovered.
    await link.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(link).toBeFocused();
    expect((await outline()).offset).toBe("0px");
});
