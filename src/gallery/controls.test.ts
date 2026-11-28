/// <reference types="deno" />

import { assertEquals, assertThrows } from "@std/assert";
import {
    type Control,
    controlQuery,
    MAX_TEXT,
    normaliseControls,
    parseControls,
} from "./controls.ts";
import type { Story } from "./story.ts";

const component = (): null => null;

const make = (
    props: Record<string, unknown>,
    controls: Story["controls"],
    content: Partial<Story> = {},
): Story => ({ name: "default", component, props, controls, ...content });

const controls: Control[] = [
    {
        key: "variant",
        kind: "choice",
        values: ["solid", "ghost"],
        value: "solid",
    },
    { key: "disabled", kind: "boolean", value: false },
    { key: "slot", kind: "text", value: "Button" },
    { key: "icon", kind: "icon", value: "lucide:check" },
];

Deno.test("a story's controls are listed in order, with the defaults the story sets", () => {
    const story = make(
        { variant: "ghost", disabled: true, label: "Hi" },
        {
            variant: ["solid", "ghost"],
            disabled: "boolean",
            label: "text",
            slot: "text",
            icon: "icon",
        },
        { slot: "Go", icon: "lucide:check" },
    );

    assertEquals(normaliseControls(story), [
        {
            key: "variant",
            kind: "choice",
            values: ["solid", "ghost"],
            value: "ghost",
        },
        { key: "disabled", kind: "boolean", value: true },
        { key: "label", kind: "text", value: "Hi" },
        { key: "slot", kind: "text", value: "Go" },
        { key: "icon", kind: "icon", value: "lucide:check" },
    ]);
});

Deno.test("a story without controls has none, and an icon control with no icon starts empty", () => {
    assertEquals(normaliseControls(make({ variant: "solid" }, undefined)), []);
    assertEquals(normaliseControls(make({}, {})), []);
    assertEquals(normaliseControls(make({}, { icon: "icon" })), [
        { key: "icon", kind: "icon", value: "" },
    ]);
});

Deno.test("a choice the story's props don't set, or set outside its values, is an error", () => {
    assertThrows(
        () => normaliseControls(make({}, { variant: ["solid"] })),
        Error,
        'controls "variant"',
    );
    assertThrows(
        () =>
            normaliseControls(
                make({ variant: "link" }, { variant: ["solid"] }),
            ),
        Error,
        "isn't one of its values",
    );
});

Deno.test("a choice may name the widget that draws it, which is kept on the control", () => {
    const [control] = normaliseControls(
        make(
            { tone: "success" },
            { tone: { values: ["primary", "success"], widget: "swatches" } },
        ),
    );

    assertEquals(control, {
        key: "tone",
        kind: "choice",
        values: ["primary", "success"],
        value: "success",
        widget: "swatches",
    });
});

Deno.test("a choice with a widget is checked like a list, and swatches need tones", () => {
    assertThrows(
        () =>
            normaliseControls(
                make(
                    { size: "xl" },
                    { size: { values: ["sm", "lg"], widget: "sizes" } },
                ),
            ),
        Error,
        "isn't one of its values",
    );
    assertThrows(
        () =>
            normaliseControls(
                make(
                    { tone: "primary" },
                    {
                        tone: {
                            values: ["primary", "plum"],
                            widget: "swatches",
                        },
                    },
                ),
            ),
        Error,
        '"plum" isn\'t one',
    );
    // Other widgets don't care what the values are.
    assertEquals(
        normaliseControls(
            make(
                { size: "sm" },
                { size: { values: ["sm", "lg"], widget: "preview" } },
                { port: "button" },
            ),
        ).length,
        1,
    );
});

Deno.test("a preview widget needs the story to have a port", () => {
    assertThrows(
        () =>
            normaliseControls(
                make(
                    { size: "sm" },
                    { size: { values: ["sm", "lg"], widget: "preview" } },
                ),
            ),
        Error,
        '"preview" needs the story to have a port',
    );
});

Deno.test("an unknown widget is an error", () => {
    assertThrows(
        () =>
            normaliseControls(
                make(
                    { size: "sm" },
                    {
                        size: {
                            values: ["sm"],
                            widget: "dial",
                        } as unknown as { values: string[]; widget: "sizes" },
                    },
                ),
            ),
        Error,
        'unknown widget "dial"',
    );
});

Deno.test("a boolean or text control needs the story to set one", () => {
    assertThrows(() => normaliseControls(make({}, { disabled: "boolean" })));
    assertThrows(() => normaliseControls(make({ a: 1 }, { a: "text" })));
});

Deno.test("slot and icon only take their own kinds, and the slot must be plain text", () => {
    assertThrows(() => normaliseControls(make({}, { slot: "boolean" })));
    assertThrows(() =>
        normaliseControls(make({ icon: "x" }, { icon: "text" })),
    );
    assertThrows(() => normaliseControls(make({ a: "x" }, { a: "icon" })));
    assertThrows(() => normaliseControls(make({}, { slot: "text" })));
    assertThrows(
        () =>
            normaliseControls(
                make({}, { slot: "text" }, { slot: "<b>Hi</b>" }),
            ),
        Error,
        "plain text",
    );
    assertThrows(
        () =>
            normaliseControls(
                make({}, { icon: "icon" }, { icon: "lucide:nope" }),
            ),
        Error,
        "built-in icon",
    );
});

Deno.test("a controlled story's icon must be one the Svelte icon draws, even with no icon control", () => {
    assertThrows(
        () =>
            normaliseControls(
                make(
                    { variant: "solid" },
                    { variant: ["solid"] },
                    { icon: "lucide:star" },
                ),
            ),
        Error,
        "built-in icon",
    );
});

Deno.test("values come from the query, and each default stands in for a bad or missing one", () => {
    assertEquals(parseControls(controls, ""), {
        variant: "solid",
        disabled: false,
        slot: "Button",
        icon: "lucide:check",
    });
    assertEquals(
        parseControls(
            controls,
            "?variant=ghost&disabled=true&slot=Go&icon=lucide:heart",
        ),
        { variant: "ghost", disabled: true, slot: "Go", icon: "lucide:heart" },
    );
    assertEquals(
        parseControls(
            controls,
            "variant=link&disabled=yes&icon=lucide:nope&other=1",
        ),
        {
            variant: "solid",
            disabled: false,
            slot: "Button",
            icon: "lucide:check",
        },
    );
});

Deno.test("an empty icon or slot in the query means none, and text is cut at 200 characters", () => {
    const values = parseControls(controls, "icon=&slot=");
    assertEquals(values.icon, "");
    assertEquals(values.slot, "");

    const long = parseControls(controls, `slot=${"x".repeat(MAX_TEXT + 50)}`);
    assertEquals((long.slot as string).length, MAX_TEXT);
});

Deno.test("a query holds only the values that differ from the defaults, in control order", () => {
    assertEquals(controlQuery(controls, parseControls(controls, "")), "");
    assertEquals(
        controlQuery(controls, {
            icon: "",
            slot: "Go on",
            disabled: true,
            variant: "solid",
        }),
        "disabled=true&slot=Go+on&icon=",
    );
});

Deno.test("a query read back gives the same values", () => {
    const values = {
        variant: "ghost",
        disabled: true,
        slot: "A & B",
        icon: "",
    };

    assertEquals(
        parseControls(controls, controlQuery(controls, values)),
        values,
    );
});
