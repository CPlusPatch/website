/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/catalog";
import type { Scenario } from "@cpluspatch/sim";
import { assertEquals } from "@std/assert";
import { bodyCount, savedMeta } from "./rows.ts";

const withBodies = (count: number, time?: number): Scenario => ({
    ...solarSystem,
    bodies: solarSystem.bodies.slice(0, count),
    time,
});

Deno.test("bodyCount says body for one and bodies otherwise", () => {
    assertEquals(bodyCount(withBodies(1)), "1 body");
    assertEquals(bodyCount(withBodies(3)), "3 bodies");
    assertEquals(bodyCount(withBodies(0)), "0 bodies");
});

Deno.test("savedMeta shows the scenario's own start date", () => {
    // Time 0 is J2000, which is 2000-01-01.
    const meta = savedMeta({
        savedAt: Date.UTC(2026, 10, 22),
        scenario: withBodies(2, 0),
    });

    assertEquals(meta, "2 bodies · 2000-01-01");
});

Deno.test("savedMeta falls back to the save date when the scenario has no time", () => {
    const meta = savedMeta({
        savedAt: Date.UTC(2026, 10, 22),
        scenario: withBodies(2),
    });

    assertEquals(meta, "2 bodies · 2026-11-22");
});
