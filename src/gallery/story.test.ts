/// <reference types="deno" />

import { assertEquals, assertThrows } from "@std/assert";
import {
    combinationPath,
    combinations,
    MAX_COMBINATIONS,
    type Story,
} from "./story.ts";

const component = (): null => null;

const make = (
    props: Record<string, unknown>,
    controls?: Record<string, readonly string[]>,
): Story => ({ name: "default", component, props, controls });

Deno.test("a story without controls has no combinations", () => {
    assertEquals(combinations(make({ variant: "solid" })), []);
    assertEquals(combinations(make({ variant: "solid" }, {})), []);
});

Deno.test("combinations are named by their values, the first control changing slowest", () => {
    const story = make(
        { variant: "solid", tone: "primary" },
        { variant: ["solid", "ghost"], tone: ["primary", "danger", "muted"] },
    );

    assertEquals(
        combinations(story).map(({ combo }) => combo),
        [
            "solid-danger",
            "solid-muted",
            "ghost-primary",
            "ghost-danger",
            "ghost-muted",
        ],
    );
});

Deno.test("the default combination isn't listed, wherever it sits in the values", () => {
    const story = make(
        { variant: "ghost", tone: "danger" },
        { variant: ["solid", "ghost"], tone: ["primary", "danger"] },
    );

    const combos = combinations(story).map(({ combo }) => combo);

    assertEquals(combos, ["solid-primary", "solid-danger", "ghost-primary"]);
});

Deno.test("a combination is the story with the controlled props set, and nothing else changed", () => {
    const story: Story = {
        ...make(
            { variant: "solid", tone: "primary", disabled: true },
            { variant: ["solid", "ghost"] },
        ),
        slot: "Button",
    };

    const [only, ...rest] = combinations(story);

    assertEquals(rest, []);
    assertEquals(only?.combo, "ghost");
    assertEquals(only?.story.props, {
        variant: "ghost",
        tone: "primary",
        disabled: true,
    });
    assertEquals(only?.story.name, "default");
    assertEquals(only?.story.slot, "Button");
    assertEquals(story.props.variant, "solid");
});

Deno.test("a control the story's props don't set is an error", () => {
    assertThrows(
        () => combinations(make({}, { variant: ["solid", "ghost"] })),
        Error,
        'controls "variant"',
    );
});

Deno.test("a story whose prop isn't one of the control's values is an error", () => {
    assertThrows(
        () => combinations(make({ variant: "link" }, { variant: ["solid"] })),
        Error,
        "isn't one of its controlled values",
    );
});

Deno.test("two combinations with the same name are an error", () => {
    const story = make(
        { a: "x-y", b: "z" },
        { a: ["x-y", "x"], b: ["z", "y-z"] },
    );

    assertThrows(() => combinations(story), Error, '"x-y-z"');
});

Deno.test("a combination name that isn't lowercase with hyphens is an error", () => {
    assertThrows(
        () => combinations(make({ size: "sm" }, { size: ["sm", "Large"] })),
        Error,
        '"Large"',
    );
});

Deno.test("a story may make up to 64 combinations, and no more", () => {
    const values = (n: number) => Array.from({ length: n }, (_, i) => `v${i}`);
    const ok = make({ a: "v0", b: "v0" }, { a: values(8), b: values(8) });
    const over = make({ a: "v0", b: "v0" }, { a: values(8), b: values(9) });

    assertEquals(combinations(ok).length, MAX_COMBINATIONS - 1);
    assertThrows(() => combinations(over), Error, "72 combinations");
});

Deno.test("a combination's page is under its story's", () => {
    assertEquals(
        combinationPath("button-variant", "default", "ghost-danger"),
        "/gallery/story/button-variant/default/ghost-danger/",
    );
});
