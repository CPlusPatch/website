/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { sheetAfterDrag, sheetSpace } from "./sheet.ts";

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

Deno.test("the sheet space reaches the top of the highest shown card", () => {
    const cards = [
        { top: 500, height: 200 },
        { top: 300, height: 0 },
        { top: 400, height: 80 },
    ];

    assertEquals(sheetSpace(700, cards), 300);
});

Deno.test("no shown cards leave no sheet space", () => {
    assertEquals(sheetSpace(700, []), 0);
    assertEquals(sheetSpace(700, [{ top: 300, height: 0 }]), 0);
});
