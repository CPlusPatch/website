/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { goLiveName, type LiveOffset } from "./go-live.ts";

const OFFSET: LiveOffset = {
    full: "2 d 3 h",
    short: "2 d",
    spoken: "2 days",
    word: "ahead",
};

Deno.test("the Now flag is named Now, go live, with the offset in the description", () => {
    assertEquals(goLiveName(true, OFFSET, false), {
        label: "Now, go live",
        description: "The clock is 2 days ahead",
    });
});

Deno.test("the button's name has the full offset, or the short one on a phone", () => {
    assertEquals(goLiveName(false, OFFSET, false), {
        label: "Go live, 2 d 3 h ahead",
        description: "The clock is 2 days ahead",
    });
    assertEquals(goLiveName(false, OFFSET, true).label, "Go live, 2 d ahead");
});

Deno.test("without an offset the name is Go live and there is no description", () => {
    assertEquals(goLiveName(false, null, false), {
        label: "Go live",
        description: "",
    });
    assertEquals(goLiveName(true, null, true), {
        label: "Now, go live",
        description: "",
    });
});
