/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { nextTabIndex } from "./tabs.ts";

Deno.test("the arrows move by one and wrap", () => {
    assertEquals(nextTabIndex("ArrowRight", 0, 3), 1);
    assertEquals(nextTabIndex("ArrowRight", 2, 3), 0);
    assertEquals(nextTabIndex("ArrowLeft", 1, 3), 0);
    assertEquals(nextTabIndex("ArrowLeft", 0, 3), 2);
});

Deno.test("Home and End jump to the ends", () => {
    assertEquals(nextTabIndex("Home", 2, 3), 0);
    assertEquals(nextTabIndex("End", 0, 3), 2);
});

Deno.test("other keys, and no tabs, move nothing", () => {
    assertEquals(nextTabIndex("ArrowDown", 0, 3), undefined);
    assertEquals(nextTabIndex("Enter", 0, 3), undefined);
    assertEquals(nextTabIndex("ArrowRight", 0, 0), undefined);
});

Deno.test("one tab wraps onto itself", () => {
    assertEquals(nextTabIndex("ArrowRight", 0, 1), 0);
    assertEquals(nextTabIndex("ArrowLeft", 0, 1), 0);
});
