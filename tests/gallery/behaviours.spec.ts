import { expect, test } from "./fixtures.ts";

/**
 * What the components do once their scripts run, one story each, through
 * the controls a reader would use.
 */
const open = (page: import("@playwright/test").Page, id: string) =>
    page.goto(`/gallery/story/${id}/`);

test("dropdown opens, and closes on Escape", async ({ page }) => {
    await open(page, "dropdown/default");
    const panel = page.locator(".dropdown__panel");
    await page.getByRole("button", { name: "Options" }).click();
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
});

test("an exclusive accordion keeps one item open", async ({ page }) => {
    await open(page, "accordion/exclusive");
    const items = page.locator("#main details");
    await expect(items.nth(0)).toHaveAttribute("open");
    await items.nth(1).locator("summary").click();
    await expect(items.nth(1)).toHaveAttribute("open");
    await expect(items.nth(0)).not.toHaveAttribute("open");
});

test("a segmented control moves with the arrow keys", async ({ page }) => {
    await open(page, "segmented-control/text");
    await page.locator("label", { hasText: "List" }).click();
    await expect(page.getByRole("radio", { name: "List" })).toBeChecked();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "Grid" })).toBeChecked();
});

test("a toggle switches", async ({ page }) => {
    await open(page, "toggle/default");
    const toggle = page.getByRole("switch", { name: "Example" });
    await expect(toggle).not.toBeChecked();
    await toggle.click({ force: true });
    await expect(toggle).toBeChecked();
});

test("a preview frame pages to snap widths and steps by a rem", async ({
    page,
}) => {
    await open(page, "preview-frame/default");
    const range = page.getByRole("slider", { name: "Preview width" });
    const content = page.locator(".preview-frame__content");

    await range.focus();
    await page.keyboard.press("PageDown");
    await expect(range).toHaveAttribute("aria-valuetext", "48 rem, Tablet");
    await expect(content).toHaveCSS("width", "768px");

    await page.keyboard.press("ArrowLeft");
    await expect(content).toHaveCSS("width", "752px");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(content).toHaveCSS("width", "784px");
});

test("a preview frame's edge drags, and snaps to a width", async ({ page }) => {
    await open(page, "preview-frame/default");
    const range = page.getByRole("slider", { name: "Preview width" });
    const content = page.locator(".preview-frame__content");
    const edge = page.locator(".preview-frame__edge");

    const frame = await content.boundingBox();
    const grip = await edge.boundingBox();
    if (!frame || !grip) throw new Error("The frame isn't on the page");

    // 32.3rem is within half a rem of Phone, 32rem.
    const grabbed = grip.x + grip.width / 2 - (frame.x + frame.width);
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(
        frame.x + 32.3 * 16 + grabbed,
        grip.y + grip.height / 2,
        {
            steps: 5,
        },
    );
    await page.mouse.up();

    await expect(range).toHaveAttribute("aria-valuetext", "32 rem, Phone");
    await expect(content).toHaveCSS("width", "512px");
});

test("a carousel moves by button and by key", async ({ page }) => {
    await open(page, "carousel/default");
    const index = page.locator("[data-carousel-index]");
    const prev = page.locator("[data-carousel-prev]");
    await expect(index).toHaveText("01");
    await expect(prev).toHaveAttribute("aria-disabled", "true");
    await page.locator("[data-carousel-next]").click();
    await expect(index).toHaveText("02");
    await expect(prev).toHaveAttribute("aria-disabled", "false");
    await page.locator("[data-carousel-track]").focus();
    await page.keyboard.press("End");
    await expect(index).toHaveText("04");
    await expect(page.locator("[data-carousel-next]")).toHaveAttribute(
        "aria-disabled",
        "true",
    );
});

test.describe("an autoplaying carousel", () => {
    test("starts paused with reduced motion", async ({ page }) => {
        await open(page, "carousel/autoplay");
        await expect(
            page.getByRole("button", { name: "Pause slideshow" }),
        ).toHaveAttribute("aria-pressed", "true");
    });

    test("turns, and stops when paused", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await open(page, "carousel/autoplay");
        const index = page.locator("[data-carousel-index]");
        // Hover holds it too, so this keeps the pointer off it.
        await expect(index).toHaveText("02", { timeout: 6000 });
        await page.getByRole("button", { name: "Pause slideshow" }).focus();
        await page.keyboard.press("Enter");
        await page.waitForTimeout(5000);
        await expect(index).toHaveText("02");
    });
});

test("the terminal runs a command and remembers it", async ({ page }) => {
    await open(page, "terminal/interactive");
    const input = page.getByRole("textbox", { name: "Terminal command" });
    await input.fill("help");
    await input.press("Enter");
    const row = page.locator(".terminal__pair").last();
    await expect(row.locator(".terminal__command")).toHaveText("help");
    await expect(row.locator(".terminal__output")).not.toBeEmpty();
    await expect(input).toHaveValue("");
    await input.press("ArrowUp");
    await expect(input).toHaveValue("help");
});

test("a dialogue answers a reply", async ({ page }) => {
    await open(page, "interactive-message/default");
    const log = page.getByRole("log");
    const before = await log.locator("p").count();
    await page.getByRole("button", { name: "Sure, I'll come over" }).click();
    await expect(log).toContainText("Sure, I'll come over");
    await expect
        .poll(() => log.locator("p").count(), { timeout: 10_000 })
        .toBeGreaterThan(before + 1);
});

test("code copies to the clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page, "code/shell");
    const button = page.getByRole("button", { name: "Copy code" });
    await button.click();
    await expect(button).toHaveAttribute("data-copied");
    const text = await page.locator("#main pre code").textContent();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        text,
    );
});

test.describe("the index's filter", () => {
    test("narrows the cards by every word, and Escape clears it", async ({
        page,
    }) => {
        await page.goto("/gallery/");
        const cards = page.locator(".gallery-card:visible");
        const all = await cards.count();
        const input = page.getByRole("searchbox", {
            name: "Filter components",
        });
        await page.keyboard.press("/");
        await expect(input).toBeFocused();

        // A story's name finds its component.
        await input.fill("carousel autoplay");
        await expect(cards).toHaveCount(1);
        await expect(cards).toContainText("Carousel");
        await expect(
            page.locator(".gallery-index__category:visible"),
        ).toHaveCount(1);
        await expect(page.getByRole("status")).toHaveText(
            `1 of ${all} components`,
        );

        await input.fill("nothing-is-called-this");
        await expect(cards).toHaveCount(0);
        await expect(page.locator(".gallery-index__empty")).toBeVisible();

        await input.press("Escape");
        await expect(input).toHaveValue("");
        await expect(cards).toHaveCount(all);
        await expect(page.locator(".gallery-index__empty")).toBeHidden();
    });

    test("lets a / be typed into it", async ({ page }) => {
        await page.goto("/gallery/");
        const input = page.getByRole("searchbox", {
            name: "Filter components",
        });
        await input.focus();
        await page.keyboard.type("a/b");
        await expect(input).toHaveValue("a/b");
    });
});

test.describe("a component's bench", () => {
    const stage = (page: import("@playwright/test").Page) =>
        page.locator('iframe[name="stage"]');
    const framePath = (page: import("@playwright/test").Page) =>
        stage(page).evaluate(
            (frame: HTMLIFrameElement) =>
                frame.contentWindow?.location.pathname,
        );
    const item = (page: import("@playwright/test").Page, name: string) =>
        page
            .getByRole("navigation", { name: "Stories" })
            .getByRole("link", { name, exact: true });

    test("puts the story in the hash on the stage", async ({ page }) => {
        await page.goto("/gallery/buttons/#button-size/sm");
        await expect(stage(page)).toHaveAttribute("title", /button-size\/sm/);
        await expect
            .poll(() => framePath(page))
            .toBe("/gallery/story/button-size/sm/");
        await expect(item(page, "sm")).toHaveAttribute("aria-current", "true");
    });

    test("has one bar, with working menus and links to the next component", async ({
        page,
    }) => {
        await page.goto("/gallery/buttons/#button-size/sm");
        await expect(page.locator("header")).toHaveCount(0);
        await expect(page.locator("#gallery-menu")).toHaveCount(1);
        await expect(
            page.getByRole("link", { name: "Component gallery" }),
        ).toHaveAttribute("href", "/gallery/");

        await page.getByRole("button", { name: "Components" }).click();
        await expect(
            page.locator("#gallery-menu").getByRole("link", { name: "Badges" }),
        ).toBeVisible();
        await page.keyboard.press("Escape");

        await page.getByRole("button", { name: "Display" }).click();
        await expect(page.locator("#display-settings")).toBeVisible();
        await page.keyboard.press("Escape");

        await page.locator('a[rel="next"]').click();
        await expect(page).toHaveURL(/\/gallery\/[a-z-]+\/(#.*)?$/);
        await expect(page.locator("h1")).not.toHaveText("Buttons");
    });

    test("moves to another story, and Back returns", async ({ page }) => {
        await page.goto("/gallery/buttons/#button-size/sm");
        await expect(item(page, "sm")).toHaveAttribute("aria-current", "true");

        await item(page, "lg").click();
        await expect(page).toHaveURL(/#button-size\/lg$/);
        await expect(item(page, "lg")).toHaveAttribute("aria-current", "true");
        await expect
            .poll(() => framePath(page))
            .toBe("/gallery/story/button-size/lg/");

        await page.goBack();
        await expect(page).toHaveURL(/#button-size\/sm$/);
        await expect(item(page, "sm")).toHaveAttribute("aria-current", "true");
        await expect
            .poll(() => framePath(page))
            .toBe("/gallery/story/button-size/sm/");
    });
});
