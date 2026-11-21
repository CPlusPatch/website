/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { J2000_UNIX_MS } from "./constants.ts";
import { j2000sToUnixMs, unixMsToJ2000s } from "./time.ts";

Deno.test("the J2000 epoch is zero seconds, and zero seconds is the J2000 epoch", () => {
    assertEquals(unixMsToJ2000s(J2000_UNIX_MS), 0);
    assertEquals(j2000sToUnixMs(0), J2000_UNIX_MS);
});

Deno.test("a time round-trips through J2000 seconds", () => {
    const ms = Date.UTC(2026, 10, 21, 8, 30, 15, 250);

    assertEquals(j2000sToUnixMs(unixMsToJ2000s(ms)), ms);
});
