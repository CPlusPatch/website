/// <reference types="deno" />

import { PRESETS } from "@cpluspatch/catalog";
import { formatSpeed } from "@cpluspatch/render";
import type { Document, Scenario, TimelineEvent } from "@cpluspatch/sim";
import { assertEquals } from "@std/assert";
import {
    firstUpcoming,
    maneuverRows,
    rejectedRemove,
    removedMessage,
    removeLabel,
} from "./maneuvers.ts";

const burn = (
    id: string,
    bodyId: string,
    t: number,
    prograde = 0,
    normal = 0,
    radial = 0,
): TimelineEvent => ({
    type: "burn",
    id,
    bodyId,
    t,
    dv: { prograde, normal, radial },
});

const setOrbit = (id: string, bodyId: string, t: number): TimelineEvent => ({
    type: "set-orbit",
    id,
    bodyId,
    t,
    elements: { a: 1e11, e: 0, i: 0, raan: 0, argp: 0, m0: 0, epoch: 0 },
});

Deno.test("maneuverRows sorts by time and keeps only the body's events", () => {
    const rows = maneuverRows(
        [
            burn("c", "mars", 300),
            burn("x", "earth", 50),
            burn("a", "mars", 100),
            burn("b", "mars", 200),
        ],
        "mars",
        0,
    );

    assertEquals(
        rows.map((row) => row.id),
        ["a", "b", "c"],
    );
});

Deno.test("maneuverRows is empty for a body with no events", () => {
    assertEquals(maneuverRows([burn("a", "mars", 1)], "earth", 0), []);
});

Deno.test("a row is past at the clock's time and not before it", () => {
    const rows = maneuverRows(
        [burn("a", "mars", 100), burn("b", "mars", 101)],
        "mars",
        100,
    );

    assertEquals(
        rows.map((row) => row.past),
        [true, false],
    );
});

Deno.test("when is the UTC date and time to the minute", () => {
    // J2000 is 2000-01-01 12:00 UTC.
    const [row] = maneuverRows([burn("a", "mars", 86400 + 90)], "mars", 0);

    assertEquals(row?.when, "2000-01-02 12:01 UTC");
});

Deno.test("a burn reads as the magnitude of its three components", () => {
    const [row] = maneuverRows(
        [burn("a", "mars", 0, 3000, 0, 4000)],
        "mars",
        0,
    );

    assertEquals(row?.what, `Δv ${formatSpeed(5000)}`);
});

Deno.test("a set-orbit reads as Orbit set", () => {
    const [row] = maneuverRows([setOrbit("a", "mars", 0)], "mars", 0);

    assertEquals(row?.what, "Orbit set");
});

Deno.test("a burn's speed splits into amount and unit, an orbit set's is empty", () => {
    const [burnRow, setRow] = maneuverRows(
        [burn("a", "mars", 0, 3000, 0, 4000), setOrbit("b", "mars", 1)],
        "mars",
        0,
    );

    assertEquals([burnRow?.amount, burnRow?.unit], ["5.00", "km/s"]);
    assertEquals([setRow?.amount, setRow?.unit], ["", ""]);
});

const DAY = 86400;
const agoAt = (dt: number): string | undefined =>
    maneuverRows([burn("a", "mars", 1e9 + dt)], "mars", 1e9)[0]?.ago;

Deno.test("ago reads the two largest units for a future event", () => {
    // 3 mo is 91.3125 d, so 5 d and 6 h more floors to the day.
    assertEquals(agoAt(91.3125 * DAY + 5 * DAY + 6 * 3600), "in 3 mo 5 d");
});

Deno.test("ago reads a past event with a suffix", () => {
    assertEquals(agoAt(-(6 * DAY + 15 * 3600 + 20 * 60)), "6 d 15 h ago");
});

Deno.test("ago is one unit when the next one down is zero", () => {
    assertEquals(agoAt(2 * DAY), "in 2 d");
    assertEquals(agoAt(-3 * 3600), "3 h ago");
});

Deno.test("ago is now under a minute, either way", () => {
    assertEquals(agoAt(59), "now");
    assertEquals(agoAt(-59), "now");
    assertEquals(agoAt(60), "in 1 m");
});

Deno.test("ago counts years of 365.25 days", () => {
    assertEquals(
        agoAt(2 * 365.25 * DAY + 4 * 30.4375 * DAY + DAY),
        "in 2 y 4 mo",
    );
    assertEquals(agoAt(-365.25 * DAY), "1 y ago");
});

Deno.test("firstUpcoming is the index of the first row after the clock", () => {
    const rows = maneuverRows(
        [burn("a", "mars", 1), burn("b", "mars", 2), burn("c", "mars", 3)],
        "mars",
        2,
    );

    assertEquals(firstUpcoming(rows), 2);
    assertEquals(firstUpcoming(rows.slice(0, 2)), 2);
    assertEquals(firstUpcoming(rows.slice(2)), 0);
    assertEquals(firstUpcoming([]), 0);
});

Deno.test("the remove label and the announcement name the kind and the time", () => {
    const [burnRow, setRow] = maneuverRows(
        [burn("a", "mars", 0), setOrbit("b", "mars", 1)],
        "mars",
        0,
    );
    const when = "2000-01-01 12:00 UTC";

    assertEquals(burnRow && removeLabel(burnRow), `Remove burn at ${when}`);
    assertEquals(
        burnRow && removedMessage(burnRow),
        `Removed the burn at ${when}.`,
    );
    assertEquals(
        setRow && removedMessage(setRow),
        "Removed the orbit set at 2000-01-01 12:00 UTC.",
    );
});

const scenario: Scenario = {
    version: 3,
    name: "remove",
    bodies: [
        { id: "sun", name: "Sun", tags: [], mass: { mu: 1.3e20, radius: 7e8 } },
        {
            id: "sat",
            name: "Sat",
            tags: [],
            mass: { mu: 0, radius: 1 },
            orbit: {
                parent: "sun",
                elements: {
                    a: 1.5e11,
                    e: 0,
                    i: 0,
                    raan: 0,
                    argp: 0,
                    m0: 0,
                    epoch: 0,
                },
            },
        },
    ],
};

// The circular speed here is about 29.5 km/s, and escape needs about 41.7 km/s.
const retrograde = burn("slow", "sat", 1000, -20000);
const prograde = burn("fast", "sat", 2000, 20000);

Deno.test("removing a burn that a later burn needs says which burn fails", () => {
    const doc: Document = { scenario, timeline: [retrograde, prograde] };

    assertEquals(
        rejectedRemove(doc, "slow", PRESETS),
        "Removing this makes the burn at 2000-01-01 12:33 UTC fail. This burn would escape Sun. Escape orbits aren't supported. Remove that burn first.",
    );
});

Deno.test("removing a burn that nothing needs is accepted", () => {
    const doc: Document = { scenario, timeline: [retrograde, prograde] };

    assertEquals(rejectedRemove(doc, "fast", PRESETS), null);
});
