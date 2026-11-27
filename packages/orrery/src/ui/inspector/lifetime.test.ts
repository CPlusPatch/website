/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { lifetimeText } from "./lifetime.ts";

// J2000 is 2000-01-01 12:00 UTC.
const DAY = 86400;

Deno.test("a lifetime with both bounds reads as a range of dates", () => {
    assertEquals(
        lifetimeText({ from: 0, to: 31 * DAY }),
        "2000-01-01 to 2000-02-01",
    );
});

Deno.test("a lifetime with one bound says from or until", () => {
    assertEquals(lifetimeText({ from: DAY }), "From 2000-01-02");
    assertEquals(lifetimeText({ to: DAY }), "Until 2000-01-02");
});

Deno.test("a body with no bound has no lifetime text", () => {
    assertEquals(lifetimeText(undefined), null);
    assertEquals(lifetimeText({}), null);
});
