/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import {
    cleanSegment,
    type Field,
    isFull,
    segmentAction,
    segmentNumber,
} from "./segments.ts";

const field = (value: string, start = value.length, end = start): Field => ({
    value,
    start,
    end,
});

Deno.test("up and down arrows step, whatever the field holds", () => {
    assertEquals(segmentAction("ArrowUp", "mo", field("12")), "up");
    assertEquals(segmentAction("ArrowDown", "y", field("")), "down");
});

Deno.test("left and right arrows leave a part only at its edge", () => {
    assertEquals(segmentAction("ArrowLeft", "mo", field("12", 0)), "before");
    assertEquals(segmentAction("ArrowLeft", "mo", field("12", 1)), null);
    assertEquals(segmentAction("ArrowRight", "mo", field("12", 2)), "after");
    assertEquals(segmentAction("ArrowRight", "mo", field("12", 1)), null);
});

Deno.test("nothing is before the year or after the second", () => {
    assertEquals(segmentAction("ArrowLeft", "y", field("2030", 0)), null);
    assertEquals(segmentAction("Backspace", "y", field("")), null);
    assertEquals(segmentAction("ArrowRight", "s", field("59", 2)), null);
    assertEquals(segmentAction(":", "s", field("59", 2)), null);
});

Deno.test("backspace in an empty part goes back", () => {
    assertEquals(segmentAction("Backspace", "d", field("")), "before");
    assertEquals(segmentAction("Backspace", "d", field("1")), null);
});

Deno.test("separators go to the next part", () => {
    for (const key of ["-", ":", " ", "/"]) {
        assertEquals(segmentAction(key, "mo", field("1")), "after");
    }
    assertEquals(segmentAction("a", "mo", field("1")), null);
});

Deno.test("a minus at the start of the year is a sign", () => {
    assertEquals(segmentAction("-", "y", field("", 0)), null);
    assertEquals(segmentAction("-", "y", field("2030", 0)), null);
    assertEquals(segmentAction("-", "y", field("-2030", 0)), "after");
    assertEquals(segmentAction("-", "y", field("-2030", 0, 5)), null);
    assertEquals(segmentAction("-", "y", field("2030", 4)), "after");
});

Deno.test("a part keeps its digits, and the year a leading minus", () => {
    assertEquals(cleanSegment("mo", "1a2-"), "12");
    assertEquals(cleanSegment("y", "-20-3x0"), "-2030");
    assertEquals(cleanSegment("y", "2-030"), "2030");
});

Deno.test("a part is full at its digit count, not counting the minus", () => {
    assertEquals(isFull("y", "-2030"), true);
    assertEquals(isFull("y", "-203"), false);
    assertEquals(isFull("mo", "12"), true);
    assertEquals(isFull("mo", "1"), false);
});

Deno.test("text that isn't a number reads as NaN", () => {
    assertEquals(segmentNumber("y", "-12"), -12);
    assertEquals(segmentNumber("mo", "07"), 7);
    assertEquals(Number.isNaN(segmentNumber("mo", "")), true);
    assertEquals(Number.isNaN(segmentNumber("mo", "-1")), true);
    assertEquals(Number.isNaN(segmentNumber("y", "-")), true);
});
