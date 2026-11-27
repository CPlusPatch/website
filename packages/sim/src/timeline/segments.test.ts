/// <reference types="deno" />

import { PRESETS } from "@cpluspatch/catalog";
import { applyBurn, type Elements } from "@cpluspatch/orbit";
import { assert, assertEquals } from "@std/assert";
import type { TimelineEvent } from "../document.ts";
import { documentOf } from "../document.ts";
import { elementsAt, precess } from "../precession.ts";
import { expandPresets } from "../presets.ts";
import type { Scenario } from "../scenario.ts";
import { compile, statesAt } from "../snapshot.ts";
import { segmentIn, segmentsByBody } from "./segments.ts";

const base: Elements = {
    a: 7e6,
    e: 0.01,
    i: 0.9,
    raan: 0.3,
    argp: 0.2,
    m0: 0,
    epoch: 0,
};

const scenario: Scenario = {
    version: 3,
    name: "timeline",
    bodies: [
        { id: "sun", name: "Sun", tags: [], mass: { mu: 1.3e20, radius: 7e8 } },
        {
            id: "earth",
            name: "Earth",
            tags: [],
            preset: "earth",
            mass: { mu: 3.986e14, radius: 6.371e6 },
            orbit: {
                parent: "sun",
                elements: { ...base, a: 1.5e11, e: 0.0167, i: 0, raan: 0 },
            },
        },
        {
            id: "sat",
            name: "Sat",
            tags: [],
            mass: { mu: 0, radius: 1 },
            orbit: { parent: "earth", elements: base },
            perturbations: [{ type: "j2" }],
        },
    ],
};

const bodies = expandPresets(scenario, PRESETS).bodies;
const dv = { prograde: 50, normal: 10, radial: 0 };
const burn = (
    id: string,
    t: number,
): Extract<TimelineEvent, { type: "burn" }> => ({
    type: "burn",
    id,
    bodyId: "sat",
    t,
    dv,
});

const segmentsOfSat = (timeline: TimelineEvent[]) => {
    const result = segmentsByBody(bodies, timeline);
    assert(result.ok);

    return result.segments.get("sat") ?? [];
};

Deno.test("segments: no events gives one segment over all time", () => {
    const [only, ...rest] = segmentsOfSat([]);

    assertEquals(rest, []);
    assertEquals(only?.from, Number.NEGATIVE_INFINITY);
    assertEquals(only?.to, Number.POSITIVE_INFINITY);
    assertEquals(only?.elements, base);
});

Deno.test("segments: each event starts a segment, in time order", () => {
    const later = burn("e1", 2e6);
    const earlier = burn("e2", 1e6);
    const segments = segmentsOfSat([later, earlier]);

    assertEquals(
        segments.map((segment) => [segment.from, segment.to]),
        [
            [Number.NEGATIVE_INFINITY, 1e6],
            [1e6, 2e6],
            [2e6, Number.POSITIVE_INFINITY],
        ],
    );
});

Deno.test("segments: an event applies at exactly its time", () => {
    const segments = segmentsOfSat([burn("e1", 1e6)]);

    assertEquals(segmentIn(segments, 1e6 - 1), segments[0]);
    assertEquals(segmentIn(segments, 1e6), segments[1]);
    assertEquals(segmentIn(segments, 1e9), segments[1]);
});

Deno.test("segments: events at the same time keep their timeline order", () => {
    const first = burn("e1", 1e6);
    const second: TimelineEvent = {
        type: "set-orbit",
        id: "e2",
        bodyId: "sat",
        t: 1e6,
        elements: { ...base, a: 8e6, epoch: 1e6 },
    };
    const segments = segmentsOfSat([first, second]);

    assertEquals(segmentIn(segments, 1e6).elements.a, 8e6);
});

Deno.test("segments: a burn starts from the orbit as precessed", () => {
    const segments = segmentsOfSat([burn("e1", 1e8)]);
    const [first, second] = segments;
    assert(first && second);

    const direct = applyBurn(
        elementsAt(base, first.precessions, 1e8),
        3.986e14,
        1e8,
        dv,
    );
    assert(direct.ok);
    assert(first.precessions[0] && first.precessions[0].nodeRate !== 0);

    assertEquals(second.elements, direct.elements);
});

Deno.test("segments: precessions are resolved again from each segment's elements", () => {
    const flat: Elements = { ...base, i: 0.1, epoch: 1e6 };
    const segments = segmentsOfSat([
        { type: "set-orbit", id: "e1", bodyId: "sat", t: 1e6, elements: flat },
    ]);
    const [before, after] = segments.map((segment) => segment.precessions[0]);

    assert(before && after);
    assert(before.nodeRate !== after.nodeRate);
});

Deno.test("segments: a burn that escapes is an error naming the body and time", () => {
    const result = segmentsByBody(bodies, [
        { ...burn("e1", 7), dv: { prograde: 1e9, normal: 0, radial: 0 } },
    ]);

    assertEquals(result, {
        ok: false,
        errors: [
            `timeline: can't burn "sat" at t=7: the burn would leave the parent's gravity`,
        ],
    });
});

Deno.test("compile: a burn then rewind gives the original orbit before the burn", () => {
    const t = 1e7;
    const original = compile(documentOf(scenario), PRESETS);
    const burned = compile({ scenario, timeline: [burn("e1", t)] }, PRESETS);

    for (const before of [-1e9, 0, t - 1]) {
        assertEquals(
            burned.elementsAt("sat", before),
            original.elementsAt("sat", before),
        );
    }

    assert(burned.elementsAt("sat", t).a !== original.elementsAt("sat", t).a);
});

Deno.test("compile: precession continues after a burn and a set-orbit", () => {
    const t = 1e7;
    const set: TimelineEvent = {
        type: "set-orbit",
        id: "e2",
        bodyId: "sat",
        t: 2e7,
        elements: { ...base, i: 0.4, epoch: 2e7 },
    };
    const system = compile(
        { scenario, timeline: [burn("e1", t), set] },
        PRESETS,
    );

    for (const at of [t + 1e6, 2e7 + 1e6]) {
        const segment = system.segmentAt("sat", at);
        const [rates] = segment.precessions;

        assert(rates && rates.nodeRate !== 0);
        assertEquals(
            system.elementsAt("sat", at),
            precess(segment.elements, rates, at),
        );
        assert(system.elementsAt("sat", at).raan !== segment.elements.raan);
    }
});

Deno.test("compile: the position doesn't jump at a burn", () => {
    const t = 1e7;
    const system = compile({ scenario, timeline: [burn("e1", t)] }, PRESETS);
    const index = system.index.get("sat") ?? 0;
    const before = statesAt(system, t - 1e-3).get("sat");
    const at = statesAt(system, t).get("sat");

    assert(before && at && index > 0);
    // The probe moves about 7 km/s, so a millisecond is a few metres.
    assert(Math.abs(before.r.x - at.r.x) < 50);
    assert(Math.abs(before.r.y - at.r.y) < 50);
});
