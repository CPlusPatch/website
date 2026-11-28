/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { filterOptions, nextActiveIndex, startIndex } from "./combobox.ts";

const options = [
    { value: "heart", label: "Heart" },
    { value: "bookmark", label: "Bookmark" },
    { value: "message-circle", label: "Message" },
];

Deno.test("an empty query keeps every option", () => {
    assertEquals(filterOptions(options, ""), options);
});

Deno.test("a query matches the label or the value, in any case", () => {
    assertEquals(filterOptions(options, "BOOK"), [options[1]]);
    assertEquals(filterOptions(options, "circle"), [options[2]]);
    assertEquals(filterOptions(options, "mess"), [options[2]]);
});

Deno.test("a query that matches nothing keeps nothing", () => {
    assertEquals(filterOptions(options, "zzz"), []);
});

Deno.test("the arrows move by one and wrap", () => {
    assertEquals(nextActiveIndex("ArrowDown", 0, 3, true), 1);
    assertEquals(nextActiveIndex("ArrowDown", 2, 3, true), 0);
    assertEquals(nextActiveIndex("ArrowUp", 1, 3, true), 0);
    assertEquals(nextActiveIndex("ArrowUp", 0, 3, true), 2);
});

Deno.test("with none active, down picks the first and up the last", () => {
    assertEquals(nextActiveIndex("ArrowDown", -1, 3, true), 0);
    assertEquals(nextActiveIndex("ArrowUp", -1, 3, true), 2);
});

Deno.test("the arrows work on a closed list, which they open", () => {
    assertEquals(nextActiveIndex("ArrowDown", -1, 3, false), 0);
});

Deno.test("Home and End jump only on an open list", () => {
    assertEquals(nextActiveIndex("Home", 2, 3, true), 0);
    assertEquals(nextActiveIndex("End", 0, 3, true), 2);
    assertEquals(nextActiveIndex("Home", 2, 3, false), undefined);
    assertEquals(nextActiveIndex("End", 0, 3, false), undefined);
});

Deno.test("other keys, and no options, move nothing", () => {
    assertEquals(nextActiveIndex("Enter", 0, 3, true), undefined);
    assertEquals(nextActiveIndex("ArrowDown", -1, 0, true), undefined);
});

Deno.test("an opened list starts on the pick when it's shown", () => {
    assertEquals(startIndex(options, "message-circle", undefined), 2);
    assertEquals(startIndex(options, "message-circle", ""), 2);
});

Deno.test("an opened list with no shown pick starts on none, or the first match when typed", () => {
    assertEquals(startIndex(options, "", undefined), -1);
    assertEquals(startIndex(options, "gone", undefined), -1);
    assertEquals(startIndex(options, "", ""), 0);
});

Deno.test("a typed filter starts on its first match, not the pick", () => {
    assertEquals(startIndex(options.slice(1), "message-circle", "m"), 0);
});

Deno.test("an empty list has no start", () => {
    assertEquals(startIndex([], "heart", "zzz"), -1);
});
