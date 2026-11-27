/// <reference types="deno" />

import { assertEquals, assertThrows } from "@std/assert";
import {
    type BenchGroup,
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

const groups: BenchGroup[] = [
    {
        id: "button-size",
        title: "Size",
        tags: [],
        stories: [
            { name: "sm", tags: [], source: "" },
            { name: "lg", tags: [], source: "" },
        ],
    },
    empty,
];

Deno.test("a story's hash names it, and a group's hash names all its stories", () => {
    assertEquals(
        parseHash(groups, pickHash({ group: "button-size", story: "lg" })),
        {
            group: "button-size",
            story: "lg",
        },
    );
    assertEquals(parseHash(groups, "#button-size"), {
        group: "button-size",
        story: null,
    });
});

Deno.test("a hash names nothing when its group, story or depth isn't known", () => {
    assertEquals(parseHash(groups, "#nope"), undefined);
    assertEquals(parseHash(groups, "#button-size/xl"), undefined);
    assertEquals(parseHash(groups, "#button-size/sm/extra"), undefined);
    assertEquals(parseHash(groups, ""), undefined);
});

Deno.test("a malformed hash names nothing instead of throwing", () => {
    assertEquals(parseHash(groups, "#%"), undefined);
});

Deno.test("a pick's page is its story's own, or its group's", () => {
    assertEquals(
        pickPath({ group: "empty", story: null }),
        "/gallery/story/empty/",
    );
});

Deno.test("the bench opens on the first group's first story, or the group when it has none", () => {
    assertEquals(firstPick(groups), { group: "button-size", story: "sm" });
    assertEquals(firstPick([empty]), { group: "empty", story: null });
    assertThrows(() => firstPick([]));
});
