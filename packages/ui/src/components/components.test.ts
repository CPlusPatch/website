/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { alertClasses, alertPrefix } from "./alert.ts";
import { avatarClasses, initials } from "./avatar.ts";
import { badgeClasses } from "./badge.ts";
import { buttonClasses, isAnchor } from "./button.ts";
import { cardClasses } from "./card.ts";
import { autoplaySeconds } from "./carousel.ts";
import { cornerWindowClasses } from "./corner-window.ts";
import { dropdownClasses, dropdownPanelClasses } from "./dropdown.ts";
import { formatCount, postActionClasses, postClasses } from "./post.ts";
import { progressClasses } from "./progress.ts";
import { segmentedClasses } from "./segmented-control.ts";
import { statusClasses, statusLightClasses } from "./status.ts";
import { toggleClasses } from "./toggle.ts";

Deno.test("button defaults, in the order the stylesheet expects", () => {
    assertEquals(buttonClasses(), [
        "button",
        "lift",
        "button--solid",
        "tone-primary",
        "button--size-default",
    ]);
});

Deno.test("button lifts unless asked not to, and never as a link", () => {
    assertEquals(buttonClasses({ lift: false }).includes("lift"), false);
    assertEquals(buttonClasses({ variant: "link" }).includes("lift"), false);
    assertEquals(buttonClasses({ variant: "ghost" }).includes("lift"), true);
});

Deno.test("button takes variant, tone, size and a trailing class", () => {
    assertEquals(
        buttonClasses({
            variant: "outline",
            tone: "neutral",
            size: "icon-sm",
            lift: false,
            class: "mine",
        }),
        [
            "button",
            "button--outline",
            "tone-neutral",
            "button--size-icon-sm",
            "mine",
        ],
    );
});

Deno.test("a button is a link when asked to, or when it has an href", () => {
    assertEquals(isAnchor("a", undefined), true);
    assertEquals(isAnchor(undefined, "/x"), true);
    assertEquals(isAnchor(undefined, undefined), false);
    assertEquals(isAnchor(undefined, ""), false);
    assertEquals(isAnchor("button", "/x"), false);
});

Deno.test("badge, card, progress and toggle classes", () => {
    assertEquals(badgeClasses({ size: "lg", class: "x" }), [
        "badge",
        "badge--solid",
        "tone-primary",
        "badge--size-lg",
        "x",
    ]);
    assertEquals(cardClasses({ tone: "secondary", lift: false }), [
        "card",
        "panel",
        "tone-secondary",
    ]);
    assertEquals(cardClasses({ rule: true }), [
        "card",
        "panel",
        "lift",
        "card--rule",
        "tone-primary",
    ]);
    assertEquals(progressClasses(), ["progress"]);
    assertEquals(progressClasses({ tone: "success" }), [
        "progress",
        "tone-success",
    ]);
    assertEquals(toggleClasses(), ["toggle"]);
    assertEquals(toggleClasses({ text: true }), ["toggle", "toggle--text"]);
});

Deno.test("an alert's default variant takes the primary tone", () => {
    assertEquals(alertClasses(), [
        "alert",
        "panel",
        "lift",
        "alert--default",
        "tone-primary",
    ]);
    assertEquals(alertClasses({ variant: "warning", icon: "lucide:x" }), [
        "alert",
        "panel",
        "lift",
        "alert--icon",
        "alert--warning",
        "tone-warning",
    ]);
});

Deno.test("only a non-default alert is named for screen readers", () => {
    assertEquals(alertPrefix(), null);
    assertEquals(alertPrefix("success"), "Success:");
    assertEquals(alertPrefix("warning"), "Warning:");
    assertEquals(alertPrefix("destructive"), "Error:");
});

Deno.test("initials are the first and last word's first letters", () => {
    assertEquals(initials("Ada Lovelace"), "AL");
    assertEquals(initials("jesse"), "J");
    assertEquals(initials("  Mary  Jane   Watson "), "MW");
    assertEquals(initials(""), "");
    assertEquals(avatarClasses({ size: "sm" }), ["avatar", "avatar--size-sm"]);
});

Deno.test("status light is toned and pulsing only when asked", () => {
    assertEquals(statusClasses({ class: "x" }), ["status", "x"]);
    assertEquals(statusLightClasses(), ["status__light"]);
    assertEquals(statusLightClasses({ tone: "success", pulse: true }), [
        "status__light",
        "tone-success",
        "status__light--toned",
        "status__light--pulse",
    ]);
});

Deno.test("corner window is pinned unless inline", () => {
    assertEquals(cornerWindowClasses(), [
        "corner-window",
        "corner-window--end",
        "corner-window--pinned",
    ]);
    assertEquals(cornerWindowClasses({ corner: "start", inline: true }), [
        "corner-window",
        "corner-window--start",
    ]);
});

Deno.test("dropdown collapse and panel alignment", () => {
    assertEquals(dropdownClasses(), ["dropdown"]);
    assertEquals(dropdownClasses({ collapseBelow: "30rem" }), [
        "dropdown",
        "dropdown--collapse-30rem",
    ]);
    assertEquals(dropdownPanelClasses(), [
        "dropdown__panel",
        "dropdown__panel--align-start",
    ]);
    assertEquals(dropdownPanelClasses("end")[1], "dropdown__panel--align-end");
});

Deno.test("segmented control classes", () => {
    assertEquals(segmentedClasses({ variant: "subtle", size: "sm" }), [
        "segmented",
        "segmented--size-sm",
        "segmented--subtle",
    ]);
});

Deno.test("autoplay is off, the default, or a number of seconds", () => {
    assertEquals(autoplaySeconds(false), undefined);
    assertEquals(autoplaySeconds(undefined), undefined);
    assertEquals(autoplaySeconds(0), undefined);
    assertEquals(autoplaySeconds(true), 6);
    assertEquals(autoplaySeconds(10), 10);
});

Deno.test("post classes", () => {
    assertEquals(postClasses(), ["post", "post--feed"]);
    assertEquals(
        postClasses({ variant: "boxed", featured: true, context: true }),
        ["post", "post--boxed", "post--featured", "post--context"],
    );
});

Deno.test("post action is pressed or filled only when asked", () => {
    assertEquals(postActionClasses(), ["post-action"]);
    assertEquals(postActionClasses({ pressed: true, filled: true }), [
        "post-action",
        "post-action--pressed",
        "post-action--filled",
    ]);
    assertEquals(postActionClasses({ end: true }), [
        "post-action",
        "post-action--end",
    ]);
});

Deno.test("counts are compact beside an action, whole in the stats row, and absent at zero", () => {
    assertEquals(formatCount(0), "");
    assertEquals(formatCount(undefined), "");
    assertEquals(formatCount(Number.NaN), "");
    assertEquals(formatCount(48), "48");
    assertEquals(formatCount(1204), "1.2K");
    assertEquals(formatCount(38900), "38.9K");
    assertEquals(formatCount(1204, { compact: false }), "1,204");
});
