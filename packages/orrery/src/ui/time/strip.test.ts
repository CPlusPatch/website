/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { MAX_T, MIN_T } from "../../timeline.ts";
import type { Hit } from "./draw.ts";
import {
    ariaValues,
    flagAt,
    hoverTime,
    keyStep,
    nowOffsetPx,
    scrubTime,
    tipLeft,
} from "./strip.ts";

const HALF = 600;

const hit = (from: number, to: number): Hit => ({
    from,
    to,
    x: (from + to) / 2,
    t: 0,
    tip: "",
});

Deno.test("dragging right by half the strip goes back by half the window", () => {
    assertEquals(scrubTime(1000, 100, 200, HALF), 1000 + HALF);
    assertEquals(scrubTime(1000, -100, 200, HALF), 1000 - HALF);
});

Deno.test("scrubbing stops at the first and last time", () => {
    assertEquals(scrubTime(MIN_T, -1000, 200, HALF), MIN_T);
    assertEquals(scrubTime(MAX_T, 1000, 200, HALF), MAX_T);
});

Deno.test("the time under the middle of the strip is the clock's", () => {
    assertEquals(hoverTime(1000, 100, 200, HALF), 1000);
    assertEquals(hoverTime(1000, 0, 200, HALF), 1000 - HALF);
    assertEquals(hoverTime(1000, 200, 200, HALF), 1000 + HALF);
    assertEquals(hoverTime(MAX_T, 200, 200, HALF), MAX_T);
});

Deno.test("the Now mark is left of the middle when real time is behind the clock", () => {
    assertEquals(nowOffsetPx(1000, 1000, 200, HALF), 0);
    assertEquals(nowOffsetPx(1000 + HALF, 1000, 200, HALF), 100);
    assertEquals(nowOffsetPx(1000 - HALF, 1000, 200, HALF), -100);
});

Deno.test("flags are found in the events row only, with 2 px of slack", () => {
    const hits = [hit(10, 20)];

    assertEquals(flagAt(hits, 15, 80, 100), hits[0]);
    assertEquals(flagAt(hits, 8, 80, 100), hits[0]);
    assertEquals(flagAt(hits, 22, 80, 100), hits[0]);
    assertEquals(flagAt(hits, 7, 80, 100), undefined);
    assertEquals(flagAt(hits, 23, 80, 100), undefined);
    assertEquals(flagAt(hits, 15, 10, 100), undefined);
});

Deno.test("the tip is centred on the pointer", () => {
    assertEquals(tipLeft(0, 500, 100, 1000), 450);
    assertEquals(tipLeft(20, 500, 100, 1000), 450);
});

Deno.test("the tip stays 4 px inside the viewport", () => {
    assertEquals(tipLeft(0, 0, 100, 1000), 4);
    assertEquals(tipLeft(0, 1000, 100, 1000), 896);
    assertEquals(tipLeft(20, 0, 100, 1000), -16);
});

Deno.test("arrows move one tick and page keys ten", () => {
    assertEquals(keyStep("ArrowLeft", HALF), -10);
    assertEquals(keyStep("ArrowRight", HALF), 10);
    assertEquals(keyStep("PageUp", HALF), 100);
    assertEquals(keyStep("PageDown", HALF), -100);
});

Deno.test("other keys don't move the clock", () => {
    assertEquals(keyStep("Home", HALF), undefined);
    assertEquals(keyStep("a", HALF), undefined);
});

Deno.test("the slider's range is the window around the clock", () => {
    const values = ariaValues(1000.4, HALF);

    assertEquals(values.min, "400");
    assertEquals(values.max, "1600");
    assertEquals(values.now, "1000");
    assertEquals(values.text.endsWith("UTC"), true);
});
