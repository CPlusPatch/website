/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { pickDirection } from "./segmented-control.ts";

Deno.test("a pick later in the row moves forward, an earlier one back", () => {
    assertEquals(pickDirection(0, 2), "forward");
    assertEquals(pickDirection(2, 1), "back");
});

Deno.test("a first pick, or the same pick again, has no direction", () => {
    assertEquals(pickDirection(-1, 1), undefined);
    assertEquals(pickDirection(1, 1), undefined);
});
