/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { J2000_UNIX_MS } from "./constants.ts";
import { j2000sToUnixMs, MAX_TIME, MIN_TIME, unixMsToJ2000s } from "./time.ts";

Deno.test("the J2000 epoch is zero seconds, and zero seconds is the J2000 epoch", () => {
    assertEquals(unixMsToJ2000s(J2000_UNIX_MS), 0);
    assertEquals(j2000sToUnixMs(0), J2000_UNIX_MS);
});

Deno.test("a time round-trips through J2000 seconds", () => {
    const ms = Date.UTC(2026, 10, 21, 8, 30, 15, 250);

    assertEquals(j2000sToUnixMs(unixMsToJ2000s(ms)), ms);
});

Deno.test("the time bounds are the first and last second of years -9999 and 9999", () => {
    assertEquals(
        new Date(j2000sToUnixMs(MIN_TIME)).toISOString(),
        "-009999-01-01T00:00:00.000Z",
    );
    assertEquals(
        new Date(j2000sToUnixMs(MAX_TIME)).toISOString(),
        "9999-12-31T23:59:59.000Z",
    );
});
