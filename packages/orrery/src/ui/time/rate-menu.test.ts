/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { menuTarget } from "./rate-menu.ts";

Deno.test("the arrows wrap around the menu", () => {
    assertEquals(menuTarget("ArrowDown", 1, 4), 2);
    assertEquals(menuTarget("ArrowDown", 3, 4), 0);
    assertEquals(menuTarget("ArrowUp", 2, 4), 1);
    assertEquals(menuTarget("ArrowUp", 0, 4), 3);
});

Deno.test("an unknown item counts as the top for Up", () => {
    assertEquals(menuTarget("ArrowUp", -1, 4), 3);
    assertEquals(menuTarget("ArrowDown", -1, 4), 0);
});

Deno.test("Home and End go to the ends, other keys nowhere", () => {
    assertEquals(menuTarget("Home", 2, 4), 0);
    assertEquals(menuTarget("End", 2, 4), 3);
    assertEquals(menuTarget("Enter", 2, 4), undefined);
    assertEquals(menuTarget("constructor", 2, 4), undefined);
});
