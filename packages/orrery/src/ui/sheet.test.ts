/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { sheetAfterDrag } from "./sheet.ts";

Deno.test("a tap toggles the sheet", () => {
    assertEquals(sheetAfterDrag(0, false), true);
    assertEquals(sheetAfterDrag(0, true), false);
    assertEquals(sheetAfterDrag(7, false), true);
    assertEquals(sheetAfterDrag(-7, true), false);
});

Deno.test("a drag up opens the sheet, even when it's open", () => {
    assertEquals(sheetAfterDrag(-8, false), true);
    assertEquals(sheetAfterDrag(-40, true), true);
});

Deno.test("a drag down closes the sheet, even when it's closed", () => {
    assertEquals(sheetAfterDrag(8, true), false);
    assertEquals(sheetAfterDrag(40, false), false);
});
