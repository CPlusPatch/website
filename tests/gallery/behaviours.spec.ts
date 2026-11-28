import { THEMES } from "../../packages/ui/src/styles/themes/index.ts";
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

        await expect(
            page.getByRole("group", { name: "Page colours" }),
        ).toBeVisible();

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

    const inspector = (page: import("@playwright/test").Page) =>
        page.getByRole("complementary", { name: "Inspector" });
    const frameAttr = (
        page: import("@playwright/test").Page,
        name: "galleryStage" | "galleryOutline",
    ) =>
        stage(page).evaluate(
            (frame: HTMLIFrameElement, key: string) =>
                frame.contentDocument?.documentElement.dataset[key],
            name,
        );

    const frameSearch = (page: import("@playwright/test").Page) =>
        stage(page).evaluate(
            (frame: HTMLIFrameElement) => frame.contentWindow?.location.search,
        );
    const frameButtonClass = (page: import("@playwright/test").Page) =>
        stage(page).evaluate(
            (frame: HTMLIFrameElement) =>
                frame.contentDocument?.querySelector("main button")?.className,
        );

    test("sets a controlled story's props in the frame without reloading it, and Back returns", async ({
        page,
    }) => {
        await page.goto("/gallery/buttons/#button-variant/default");
        const variant = inspector(page).getByRole("group", { name: "variant" });
        await expect(variant.getByLabel("solid")).toBeChecked();
        await expect
            .poll(() => framePath(page))
            .toBe("/gallery/play/button-variant/default/");
        await expect
            .poll(() => frameButtonClass(page))
            .toContain("button--solid");

        // Still there after the pick only if the frame didn't navigate.
        await stage(page).evaluate((frame: HTMLIFrameElement) => {
            (frame.contentWindow as Window & { marker?: boolean }).marker =
                true;
        });

        await variant.getByTitle("outline", { exact: true }).click();
        await expect(page).toHaveURL(
            /#button-variant\/default\?variant=outline$/,
        );
        await expect.poll(() => frameSearch(page)).toBe("?variant=outline");
        await expect
            .poll(() => frameButtonClass(page))
            .toContain("button--outline");
        expect(await framePath(page)).toBe(
            "/gallery/play/button-variant/default/",
        );
        expect(
            await stage(page).evaluate(
                (frame: HTMLIFrameElement) =>
                    (frame.contentWindow as Window & { marker?: boolean })
                        .marker,
            ),
        ).toBe(true);

        await page.goBack();
        await expect(page).toHaveURL(/#button-variant\/default$/);
        await expect(variant.getByLabel("solid")).toBeChecked();
        await expect
            .poll(() => frameButtonClass(page))
            .toContain("button--solid");
        await expect.poll(() => frameSearch(page)).toBe("");
    });

    test("Back puts the icon combobox and the frame back", async ({ page }) => {
        await page.goto("/gallery/buttons/#button-variant/default");
        await expect.poll(() => frameButton(page)).toContain("heart");
        const icon = inspector(page).getByRole("combobox", { name: "icon" });
        await expect(icon).toHaveValue("lucide:heart");

        await icon.fill("bookm");
        await icon.press("ArrowDown");
        await icon.press("Enter");
        await expect(page).toHaveURL(/\?icon=lucide%3Abookmark$/);
        await expect(icon).toHaveValue("lucide:bookmark");
        await expect.poll(() => frameButton(page)).toContain("bookmark");

        await page.goBack();
        await expect(page).toHaveURL(/#button-variant\/default$/);
        await expect(icon).toHaveValue("lucide:heart");
        await expect.poll(() => frameButton(page)).toContain("heart");
    });

    test("Back puts the boolean switch and the frame back", async ({
        page,
    }) => {
        await page.goto("/gallery/buttons/#button-variant/default");
        const button = page
            .frameLocator('iframe[name="stage"]')
            .locator("main button");
        const disabled = inspector(page).getByRole("switch", {
            name: "disabled",
        });
        await expect(button).toBeEnabled();

        await inspector(page)
            .locator("label.toggle")
            .filter({ has: page.getByRole("switch", { name: "disabled" }) })
            .click();
        await expect(disabled).toBeChecked();
        await expect(button).toBeDisabled();

        await page.goBack();
        await expect(page).toHaveURL(/#button-variant\/default$/);
        await expect(disabled).not.toBeChecked();
        await expect(button).toBeEnabled();
    });

    test("Back puts the slot text and the frame back", async ({ page }) => {
        await page.goto("/gallery/buttons/#button-variant/default");
        const button = page
            .frameLocator('iframe[name="stage"]')
            .locator("main button");
        const input = inspector(page).getByRole("textbox", { name: "slot" });
        await expect(input).toHaveValue("Button");

        await input.fill("Save");
        await input.press("Enter");
        await expect(button).toHaveText("Save");

        await page.goBack();
        await expect(page).toHaveURL(/#button-variant\/default$/);
        await expect(input).toHaveValue("Button");
        await expect(button).toHaveText("Button");
    });

    test("loads a controlled story's values from the hash", async ({
        page,
    }) => {
        await page.goto(
            "/gallery/buttons/#button-variant/default?variant=ghost&tone=destructive",
        );
        await expect
            .poll(() => framePath(page))
            .toBe("/gallery/play/button-variant/default/");
        await expect
            .poll(() => frameSearch(page))
            .toBe("?variant=ghost&tone=destructive");
        await expect
            .poll(() => frameButtonClass(page))
            .toContain("button--ghost");

        const controls = inspector(page);
        await expect(
            controls
                .getByRole("group", { name: "variant" })
                .getByLabel("ghost"),
        ).toBeChecked();
        await expect(
            controls
                .getByRole("group", { name: "tone" })
                .getByRole("radio", { name: "destructive" }),
        ).toBeChecked();
    });

    test("turns a boolean control on, in the frame and the hash", async ({
        page,
    }) => {
        await page.goto("/gallery/buttons/#button-variant/default");
        const button = page
            .frameLocator('iframe[name="stage"]')
            .locator("main button");
        await expect(button).toBeEnabled();

        // The switch's slider covers its input, so click what a reader sees.
        await inspector(page)
            .locator("label.toggle")
            .filter({ has: page.getByRole("switch", { name: "disabled" }) })
            .click();

        await expect(page).toHaveURL(
            /#button-variant\/default\?disabled=true$/,
        );
        await expect(button).toBeDisabled();
    });

    test("sets the slot text from an input on Enter", async ({ page }) => {
        await page.goto("/gallery/buttons/#button-variant/default");
        const button = page
            .frameLocator('iframe[name="stage"]')
            .locator("main button");
        await expect(button).toHaveText("Button");

        const input = inspector(page).getByRole("textbox", { name: "slot" });
        await input.fill("Save");
        await input.press("Enter");

        await expect(button).toHaveText("Save");
        await expect(inspector(page).locator("pre")).toContainText("Save");
    });

    test("keeps the stage settings in the frame across stories", async ({
        page,
    }) => {
        await page.goto("/gallery/buttons/#button-size/sm");
        await expect
            .poll(() => framePath(page))
            .toBe("/gallery/story/button-size/sm/");
        expect(await frameAttr(page, "galleryStage")).toBeUndefined();

        await inspector(page).getByRole("tab", { name: "Look" }).click();
        await inspector(page).getByText("Dots", { exact: true }).click();
        // The slider covers the input, so click the label as a reader would.
        await inspector(page).locator("label.toggle").click();
        await expect(
            inspector(page).getByRole("switch", { name: "Outline boxes" }),
        ).toBeChecked();
        await expect.poll(() => frameAttr(page, "galleryStage")).toBe("dots");
        await expect.poll(() => frameAttr(page, "galleryOutline")).toBe("");

        await item(page, "lg").click();
        await expect
            .poll(() => framePath(page))
            .toBe("/gallery/story/button-size/lg/");
        await expect.poll(() => frameAttr(page, "galleryStage")).toBe("dots");
        await expect.poll(() => frameAttr(page, "galleryOutline")).toBe("");

        // The frame's page reads the saved settings before it paints.
        await page.reload();
        await expect
            .poll(() => framePath(page))
            .toBe("/gallery/story/button-size/lg/");
        await expect.poll(() => frameAttr(page, "galleryStage")).toBe("dots");
        await expect.poll(() => frameAttr(page, "galleryOutline")).toBe("");
    });

    const frameButton = (page: import("@playwright/test").Page) =>
        stage(page).evaluate(
            (frame: HTMLIFrameElement) =>
                frame.contentDocument?.querySelector("main button")?.outerHTML,
        );

    test("picks a tone swatch and a variant tile, in the frame and the hash", async ({
        page,
    }) => {
        await page.goto("/gallery/buttons/#button-variant/default");
        await expect
            .poll(() => frameButtonClass(page))
            .toContain("tone-primary");

        await inspector(page)
            .getByRole("group", { name: "tone" })
            .getByTitle("success", { exact: true })
            .click();
        await expect(page).toHaveURL(/\?tone=success$/);
        await expect
            .poll(() => frameButtonClass(page))
            .toContain("tone-success");

        await inspector(page)
            .getByRole("group", { name: "variant" })
            .getByTitle("ghost", { exact: true })
            .click();
        await expect(page).toHaveURL(/\?variant=ghost&tone=success$/);
        await expect
            .poll(() => frameButtonClass(page))
            .toContain("button--ghost");
    });

    test("picks a size tile, in the frame and the hash", async ({ page }) => {
        await page.goto("/gallery/buttons/#button-variant/default");
        await inspector(page)
            .getByRole("group", { name: "size" })
            .getByTitle("sm", { exact: true })
            .click();

        await expect(page).toHaveURL(/\?size=sm$/);
        await expect
            .poll(() => frameButtonClass(page))
            .toContain("button--size-sm");
    });

    test("picks an icon in the combobox by typing, in the frame and the hash", async ({
        page,
    }) => {
        await page.goto("/gallery/buttons/#button-variant/default");
        await expect.poll(() => frameButton(page)).toContain("<svg");
        const before = await frameButton(page);

        const icon = inspector(page).getByRole("combobox", { name: "icon" });
        await icon.fill("bookm");
        await icon.press("ArrowDown");
        await icon.press("Enter");

        await expect(page).toHaveURL(/\?icon=lucide%3Abookmark$/);
        await expect.poll(() => frameButton(page)).not.toBe(before);
        await expect(icon).toHaveValue("lucide:bookmark");

        // None takes the icon off.
        await icon.fill("none");
        await icon.press("ArrowDown");
        await icon.press("Enter");
        await expect(page).toHaveURL(/\?icon=$/);
        await expect.poll(() => frameButton(page)).not.toContain("<svg");
    });

    test("the tiles' previews aren't focusable, and a click on one picks it", async ({
        page,
    }) => {
        await page.goto("/gallery/buttons/#button-variant/default");
        const variant = inspector(page).getByRole("group", { name: "variant" });
        await expect(variant.getByRole("radio")).toHaveCount(4);
        await expect(variant.locator("button, a[href]")).toHaveCount(0);

        await variant.locator(".tile__preview").nth(1).click();
        await expect(page).toHaveURL(/\?variant=outline$/);
    });

    test("copies the story's source from the Code section", async ({
        page,
        context,
    }) => {
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
        await page.goto(
            "/gallery/buttons/#button-variant/default?tone=success",
        );
        const code = inspector(page).locator(".bench-code");
        await expect(code.locator("pre")).toContainText('tone="success"');

        await code.getByRole("button", { name: "Copy code" }).click();

        await expect(code.getByRole("status")).toHaveText("Copied");
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
            await code.locator("pre code").innerText(),
        );
        await expect(code.getByRole("status")).toHaveText("", {
            timeout: 5000,
        });
    });

    test("says in words when the copy fails", async ({ page }) => {
        await page.addInitScript(() => {
            navigator.clipboard.writeText = () =>
                Promise.reject(new Error("denied"));
        });
        await page.goto("/gallery/buttons/#button-variant/default");
        const code = inspector(page).locator(".bench-code");
        await expect(code.locator("pre")).toContainText("<Button");

        await code.getByRole("button", { name: "Copy code" }).click();

        const status = code.getByRole("status");
        await expect(status).toHaveText(
            "Couldn't copy. Select the code instead.",
        );
        await expect(status).toBeVisible();
        // Longer than a success, which has gone by now.
        await page.waitForTimeout(2000);
        await expect(status).toBeVisible();
        await expect(status).toHaveText("", { timeout: 5000 });
    });

    test("opens the About disclosure to the component's files", async ({
        page,
    }) => {
        await page.goto("/gallery/buttons/#button-variant/default");
        const about = inspector(page).locator("details.bench-about");
        await expect(about).not.toHaveAttribute("open");
        await expect(about.locator("summary")).toContainText("About Buttons");
        await expect(about.locator("summary")).toContainText("button.astro");
        await expect(about.getByText("ui/button.astro")).toBeHidden();

        await about.locator("summary").click();

        await expect(about).toHaveAttribute("open");
        await expect(
            about.locator(".bench-about__meta code").first(),
        ).toContainText("packages/ui/src/astro/ui/button.astro");
    });

    test("says what each tag means in the open About disclosure", async ({
        page,
    }) => {
        await page.goto("/gallery/stat/#stat");
        const about = inspector(page).locator("details.bench-about");
        const hint = about.getByText("Moves on its own");
        await expect(hint).toBeHidden();

        await about.locator("summary").click();

        await expect(hint).toBeVisible();
        await expect(about.locator(".bench-about__tags")).toContainText(
            "animated",
        );
    });

    test("switches the inspector's tabs by click and by arrow keys", async ({
        page,
    }) => {
        await page.goto("/gallery/buttons/#button-variant/default");
        const panel = (name: string) =>
            inspector(page).getByRole("tabpanel", { name });
        const props = inspector(page).getByRole("tab", { name: "Props" });
        const look = inspector(page).getByRole("tab", { name: "Look" });
        await expect(props).toHaveAttribute("aria-selected", "true");
        await expect(panel("Props")).toBeVisible();
        await expect(panel("Look")).toBeHidden();

        await look.click();
        await expect(look).toHaveAttribute("aria-selected", "true");
        await expect(panel("Look")).toBeVisible();
        await expect(panel("Props")).toBeHidden();

        await look.press("ArrowLeft");
        await expect(props).toBeFocused();
        await expect(props).toHaveAttribute("aria-selected", "true");
        await expect(panel("Props")).toBeVisible();

        await props.press("ArrowRight");
        await expect(look).toBeFocused();
        await expect(panel("Look")).toBeVisible();
    });

    test("says there are no controls for a story without them, and when no story is on stage", async ({
        page,
    }) => {
        await page.goto("/gallery/buttons/#button-size/sm");
        await expect(inspector(page)).toContainText(
            "The sm story has no controls.",
        );

        await page.goto("/gallery/buttons/#button-size");
        await expect(inspector(page)).toContainText(
            "Controls appear when one story is on stage.",
        );
    });

    test("opens all of a group's stories alone from Props, with no Code section", async ({
        page,
    }) => {
        await page.goto("/gallery/buttons/#button-size");
        const open = inspector(page).getByRole("link", { name: "Open alone" });
        await expect(open).toHaveAttribute(
            "href",
            "/gallery/story/button-size/",
        );
        await expect(inspector(page).locator(".bench-code")).toHaveCount(0);

        await page.goto("/gallery/buttons/#button-size/sm");
        await expect(inspector(page).locator(".bench-code")).toBeVisible();
        await expect(open).toBeVisible();
    });

    test("lists the props a story sets and doesn't control", async ({
        page,
    }) => {
        await page.goto("/gallery/story/bench-props/fixed-props/");
        await expect(page.locator("#main")).toContainText(
            "The story fixes as and href.",
        );

        await page.goto("/gallery/buttons/#button-variant/default");
        await expect(inspector(page)).not.toContainText("The story fixes");
    });

    const copies = (page: import("@playwright/test").Page) =>
        page.locator(".bench-compare iframe");
    const compareMode = (page: import("@playwright/test").Page, name: string) =>
        page
            .getByRole("region", { name: "Compare" })
            .getByText(name, { exact: true })
            .click();
    const copySrcs = (page: import("@playwright/test").Page) =>
        copies(page).evaluateAll((frames) =>
            frames.map((frame) => frame.getAttribute("src")),
        );

    test("compares the pick in light and dark under the stage", async ({
        page,
    }) => {
        await page.goto("/gallery/buttons/#button-size/sm");
        await expect(copies(page)).toHaveCount(2);

        expect(await copySrcs(page)).toEqual([
            "/gallery/story/button-size/sm/?scheme=light",
            "/gallery/story/button-size/sm/?scheme=dark",
        ]);
    });

    test("compares every theme", async ({ page }) => {
        await page.goto("/gallery/buttons/#button-size/sm");
        await compareMode(page, "Themes");

        await expect(copies(page)).toHaveCount(THEMES.length);
    });

    test("moves the copies to another story", async ({ page }) => {
        await page.goto("/gallery/buttons/#button-size/sm");
        await expect(copies(page)).toHaveCount(2);

        await item(page, "lg").click();

        await expect
            .poll(() => copySrcs(page))
            .toEqual([
                "/gallery/story/button-size/lg/?scheme=light",
                "/gallery/story/button-size/lg/?scheme=dark",
            ]);
    });

    test("keeps the compare mode on the next component", async ({ page }) => {
        await page.goto("/gallery/buttons/#button-size/sm");
        await compareMode(page, "Themes");
        await expect(copies(page)).toHaveCount(THEMES.length);

        await page.locator('a[rel="next"]').click();

        await expect(page.locator("h1")).not.toHaveText("Buttons");
        await expect(copies(page)).toHaveCount(THEMES.length);
    });

    const frameRoot = (
        page: import("@playwright/test").Page,
        attr: "theme" | "overrideSpacing" | "scheme",
    ) =>
        stage(page).evaluate(
            (frame: HTMLIFrameElement, key: string) =>
                frame.contentDocument?.documentElement.dataset[key],
            attr,
        );

    test("the scheme switch sets the page's scheme and not the stage's, and keeps it for the tab", async ({
        page,
    }) => {
        await page.goto("/gallery/buttons/#button-size/sm");
        await expect
            .poll(() => framePath(page))
            .toBe("/gallery/story/button-size/sm/");
        const colours = page.getByRole("group", { name: "Page colours" });
        const html = page.locator("html");

        // The system scheme, light here, until a pick.
        await expect(
            colours.getByRole("radio", { name: "Light" }),
        ).toBeChecked();
        await expect(html).not.toHaveAttribute("data-scheme");

        await colours.getByTitle("Dark").click();
        await expect(html).toHaveAttribute("data-scheme", "dark");
        expect(await frameRoot(page, "scheme")).toBeUndefined();

        await page.reload();
        await expect(html).toHaveAttribute("data-scheme", "dark");
        await expect(
            colours.getByRole("radio", { name: "Dark" }),
        ).toBeChecked();
        await expect
            .poll(() => framePath(page))
            .toBe("/gallery/story/button-size/sm/");
        expect(await frameRoot(page, "scheme")).toBeUndefined();
    });

    test("the Look tab styles the stage, shows it changed, and Reset clears it", async ({
        page,
    }) => {
        await page.goto("/gallery/buttons/#button-size/sm");
        await expect
            .poll(() => framePath(page))
            .toBe("/gallery/story/button-size/sm/");
        const look = inspector(page).getByRole("tab", { name: "Look" });
        const dot = look.locator(".tab-list__dot");
        await expect(dot).toHaveCount(0);

        await look.click();
        await inspector(page)
            .locator('label:has(input[name$="-theme"][value="nord"])')
            .click();
        await inspector(page)
            .locator('label:has(input[name$="-spacing"][value="compact"])')
            .click();

        await expect.poll(() => frameRoot(page, "theme")).toBe("nord");
        await expect
            .poll(() => frameRoot(page, "overrideSpacing"))
            .toBe("compact");
        const html = page.locator("html");
        await expect(html).not.toHaveAttribute("data-theme");
        await expect(html).not.toHaveAttribute("data-override-spacing");
        await expect(dot).toHaveCount(1);

        await inspector(page)
            .getByRole("button", { name: "Reset look" })
            .click();
        await expect.poll(() => frameRoot(page, "theme")).toBeUndefined();
        await expect
            .poll(() => frameRoot(page, "overrideSpacing"))
            .toBeUndefined();
        await expect(dot).toHaveCount(0);
    });
});

test("gallery pages ignore the saved Display choices", async ({ page }) => {
    await page.addInitScript(() =>
        localStorage.setItem("display", JSON.stringify({ theme: "nord" })),
    );

    for (const path of [
        "/gallery/",
        "/gallery/buttons/",
        "/gallery/story/button-size/sm/",
    ]) {
        await page.goto(path);
        await expect(page.locator("html"), path).not.toHaveAttribute(
            "data-theme",
        );
    }
});

test("tabs switch panels by click and by keys", async ({ page }) => {
    await open(page, "tabs/default");
    const props = page.getByRole("tab", { name: "Props" });
    const look = page.getByRole("tab", { name: "Look" });
    const propsPanel = page.getByRole("tabpanel", { name: "Props" });
    const lookPanel = page.getByRole("tabpanel", { name: "Look" });
    await expect(propsPanel).toBeVisible();
    await expect(lookPanel).toBeHidden();

    await look.click();
    await expect(look).toHaveAttribute("aria-selected", "true");
    await expect(lookPanel).toBeVisible();
    await expect(propsPanel).toBeHidden();

    await page.keyboard.press("ArrowLeft");
    await expect(props).toBeFocused();
    await expect(props).toHaveAttribute("aria-selected", "true");
    await expect(propsPanel).toBeVisible();
    await expect(lookPanel).toBeHidden();

    await page.keyboard.press("End");
    await expect(look).toBeFocused();
    await expect(lookPanel).toBeVisible();

    await page.keyboard.press("Home");
    await expect(props).toBeFocused();
    await expect(propsPanel).toBeVisible();
});

test.describe("a combobox", () => {
    const setup = async (page: import("@playwright/test").Page) => {
        await open(page, "combobox/icons");

        return {
            input: page.getByRole("combobox", { name: "Icon" }),
            list: page.getByRole("listbox", { name: "Icon" }),
            options: page.getByRole("option"),
        };
    };

    test("filters as you type", async ({ page }) => {
        const { input, list, options } = await setup(page);
        await expect(input).toHaveValue("heart");
        await expect(list).toBeHidden();

        await input.fill("ma");
        await expect(input).toHaveAttribute("aria-expanded", "true");
        await expect(options).toHaveText([/^Bookmark/, /^Maximize/]);
        await expect(options.first()).toHaveAttribute("data-active", "");

        await input.fill("zzz");
        await expect(list).toBeHidden();
        await expect(page.getByRole("status")).toHaveText("No matches");
    });

    test("picks with the arrows and Enter", async ({ page }) => {
        const { input, list, options } = await setup(page);
        await input.fill("ma");
        await page.keyboard.press("ArrowDown");
        await expect(input).toHaveAttribute(
            "aria-activedescendant",
            (await options.nth(1).getAttribute("id")) ?? "",
        );

        await page.keyboard.press("Enter");
        await expect(input).toHaveValue("maximize");
        await expect(list).toBeHidden();
        await expect(page.locator(".combobox__icon svg")).toHaveAttribute(
            "data-icon",
            "lucide:maximize",
        );

        await input.press("ArrowDown");
        await expect(options.filter({ hasText: "Maximize" })).toHaveAttribute(
            "aria-selected",
            "true",
        );
    });

    test("closes on Escape, then puts the pick back", async ({ page }) => {
        const { input, list } = await setup(page);
        await input.fill("ma");
        await expect(list).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(list).toBeHidden();
        await expect(input).toHaveValue("ma");

        await page.keyboard.press("Escape");
        await expect(input).toHaveValue("heart");
    });

    test("puts the pick back when the focus leaves", async ({ page }) => {
        const { input, list } = await setup(page);
        await input.fill("junk");
        await page.keyboard.press("Tab");
        await expect(list).toBeHidden();
        await expect(input).toHaveValue("heart");
    });

    test("picks by click", async ({ page }) => {
        const { input, list } = await setup(page);
        await input.click();
        await page.keyboard.press("ArrowDown");
        await expect(list).toBeVisible();

        await page.getByRole("option", { name: "Play" }).click();
        await expect(input).toHaveValue("play");
        await expect(list).toBeHidden();
    });

    test("reopens on the pick, scrolled into view", async ({ page }) => {
        await open(page, "combobox/text");
        const input = page.getByRole("combobox", { name: "Font" });
        const list = page.getByRole("listbox", { name: "Font" });
        await input.click();
        await page.keyboard.press("ArrowDown");
        await page.getByRole("option", { name: "Display" }).click();
        await expect(list).toBeHidden();

        await page.keyboard.press("ArrowDown");
        const display = page.getByRole("option", { name: "Display" });
        await expect(input).toHaveAttribute(
            "aria-activedescendant",
            (await display.getAttribute("id")) ?? "",
        );
        await expect(display).toBeInViewport({ ratio: 1 });
    });

    test("hovering an option makes it the active one", async ({ page }) => {
        const { input, options } = await setup(page);
        await input.click();
        await page.keyboard.press("ArrowDown");
        await options.nth(2).hover();

        await expect(options.nth(2)).toHaveAttribute("data-active", "");
        await expect(page.locator("[data-active]")).toHaveCount(1);
        await expect(input).toHaveAttribute(
            "aria-activedescendant",
            (await options.nth(2).getAttribute("id")) ?? "",
        );
    });

    test("the chevron toggles the list", async ({ page }) => {
        const { list } = await setup(page);
        await page.locator(".combobox__chevron").click();
        await expect(list).toBeVisible();

        await page.locator(".combobox__chevron").click();
        await expect(list).toBeHidden();
    });
});
