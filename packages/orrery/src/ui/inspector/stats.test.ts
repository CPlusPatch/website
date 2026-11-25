/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import type { BodyStats } from "../../body-stats.ts";
import { statRows } from "./stats.ts";

const none: BodyStats = {
    mass: null,
    radius: null,
    gravity: null,
    escapeSpeed: null,
    day: null,
    tilt: null,
};

Deno.test("statRows lists nothing for a body with no stats", () => {
    assertEquals(statRows(none), []);
});

Deno.test("statRows lists the stats a body has, in the card's order", () => {
    const rows = statRows({
        ...none,
        tilt: 0.4,
        mass: 5.97e24,
        radius: 6.371e6,
    });

    assertEquals(
        rows.map(([label]) => label),
        ["Mass", "Radius", "Axial tilt"],
    );
    assertEquals(
        rows.every(([, value]) => value.length > 0),
        true,
    );
});
