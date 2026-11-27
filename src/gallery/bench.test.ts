/// <reference types="deno" />

import { assertEquals, assertThrows } from "@std/assert";
import {
    type BenchGroup,
    type BenchStory,
    comboOf,
    firstPick,
    parseHash,
    pickHash,
    pickPath,
} from "./bench.ts";

const empty: BenchGroup = {
    id: "empty",
    title: "Empty",
    tags: [],
    stories: [],
};

const variant: BenchStory = {
    name: "default",
    tags: [],
    source: "",
    controls: [
        { prop: "variant", values: ["solid", "soft-edge"], value: "solid" },
        { prop: "tone", values: ["primary", "danger"], value: "primary" },
    ],
    combos: {
        "solid-danger": {
            source: "",
            values: { variant: "solid", tone: "danger" },
        },
        "soft-edge-primary": {
            source: "",
            values: { variant: "soft-edge", tone: "primary" },
        },
        "soft-edge-danger": {
            source: "",
            values: { variant: "soft-edge", tone: "danger" },
        },
    },
};

const groups: BenchGroup[] = [
    {
        id: "button-size",
        title: "Size",
        tags: [],
        stories: [
            { name: "sm", tags: [], source: "", controls: [], combos: {} },
            { name: "lg", tags: [], source: "", controls: [], combos: {} },
        ],
    },
    { id: "button-variant", title: "Variant", tags: [], stories: [variant] },
    empty,
];

Deno.test("a story's hash names it, and a group's hash names all its stories", () => {
    assertEquals(
        parseHash(
            groups,
            pickHash({ group: "button-size", story: "lg", combo: null }),
        ),
        {
            group: "button-size",
            story: "lg",
            combo: null,
        },
    );
    assertEquals(parseHash(groups, "#button-size"), {
        group: "button-size",
        story: null,
        combo: null,
    });
});

Deno.test("a combination's hash names it, and an unknown one names nothing", () => {
    const pick = {
        group: "button-variant",
        story: "default",
        combo: "soft-edge-danger",
    };

    assertEquals(pickHash(pick), "#button-variant/default/soft-edge-danger");
    assertEquals(parseHash(groups, pickHash(pick)), pick);
    assertEquals(
        parseHash(groups, "#button-variant/default/solid-solid"),
        undefined,
    );
    assertEquals(
        parseHash(groups, "#button-variant/default/toString"),
        undefined,
    );
    assertEquals(parseHash(groups, "#button-size/sm/solid-danger"), undefined);
});

Deno.test("a hash names nothing when its group, story or depth isn't known", () => {
    assertEquals(parseHash(groups, "#nope"), undefined);
    assertEquals(parseHash(groups, "#button-size/xl"), undefined);
    assertEquals(parseHash(groups, "#button-size/sm/extra"), undefined);
    assertEquals(
        parseHash(groups, "#button-variant/default/solid-danger/extra"),
        undefined,
    );
    assertEquals(parseHash(groups, ""), undefined);
});

Deno.test("a malformed hash names nothing instead of throwing", () => {
    assertEquals(parseHash(groups, "#%"), undefined);
});

Deno.test("a pick's page is its story's own, or its group's", () => {
    assertEquals(
        pickPath({ group: "empty", story: null, combo: null }),
        "/gallery/story/empty/",
    );
    assertEquals(
        pickPath({ group: "button-size", story: "sm", combo: null }),
        "/gallery/story/button-size/sm/",
    );
});

Deno.test("a combination's page is its own", () => {
    assertEquals(
        pickPath({
            group: "button-variant",
            story: "default",
            combo: "solid-danger",
        }),
        "/gallery/story/button-variant/default/solid-danger/",
    );
});

Deno.test("values name a combination, or none when each is the story's own", () => {
    assertEquals(comboOf(variant, { variant: "solid", tone: "primary" }), null);
    assertEquals(comboOf(variant, {}), null);
    assertEquals(
        comboOf(variant, { variant: "soft-edge", tone: "danger" }),
        "soft-edge-danger",
    );
    assertEquals(comboOf(variant, { tone: "danger" }), "solid-danger");
});

Deno.test("the bench opens on the first group's first story, or the group when it has none", () => {
    assertEquals(firstPick(groups), {
        group: "button-size",
        story: "sm",
        combo: null,
    });
    assertEquals(firstPick([empty]), {
        group: "empty",
        story: null,
        combo: null,
    });
    assertThrows(() => firstPick([]));
});
