/// <reference types="deno" />

import { PRESETS, solarSystem } from "@cpluspatch/catalog";
import { assert, assertEquals } from "@std/assert";
import type { TimelineEvent } from "../document.ts";
import { validateTimeline } from "./validate.ts";

const elements = {
    a: 1e7,
    e: 0.1,
    i: 0.5,
    raan: 1,
    argp: 2,
    m0: 3,
    epoch: 100,
};
const dv = { prograde: 1, normal: 0, radial: 0 };
const valid: TimelineEvent[] = [
    { type: "burn", id: "e1", bodyId: "earth", t: 0, dv },
    { type: "set-orbit", id: "e2", bodyId: "iss", t: 5, elements },
];

const check = (input: unknown) => validateTimeline(input, solarSystem, PRESETS);

const failures = (input: unknown): string[] => {
    const result = check(input);
    assert(!result.ok);

    return result.errors;
};

Deno.test("validateTimeline accepts events and returns them clean", () => {
    const result = check([{ ...valid[0], extra: 1 }, valid[1]]);

    assertEquals(result, { ok: true, timeline: valid });
});

Deno.test("validateTimeline accepts an empty timeline", () => {
    assertEquals(check([]), { ok: true, timeline: [] });
});

Deno.test("validateTimeline needs an array of objects", () => {
    assertEquals(failures({}), ["timeline: must be an array (got object)"]);
    assertEquals(failures([null]), [
        "timeline[0]: must be an object (got null)",
    ]);
});

Deno.test("validateTimeline checks type, id and body", () => {
    const [type, id, body, root] = [
        failures([{ ...valid[0], type: "jump" }]),
        failures([{ ...valid[0], id: "" }]),
        failures([{ ...valid[0], bodyId: "nope" }]),
        failures([{ ...valid[0], bodyId: "sun" }]),
    ];

    assertEquals(type, [
        'timeline[0].type: must be "burn" or "set-orbit" (got "jump")',
    ]);
    assertEquals(id, ['timeline[0].id: must be a non-empty string (got "")']);
    assertEquals(body, ['timeline[0].bodyId: there is no body "nope"']);
    assertEquals(root, ['timeline[0].bodyId: "sun" has no orbit']);
});

Deno.test("validateTimeline rejects a repeated id", () => {
    assertEquals(failures([valid[0], { ...valid[1], id: "e1" }]), [
        'timeline[1].id: must be unique (got "e1")',
    ]);
});

Deno.test("validateTimeline checks t and the burn", () => {
    assertEquals(failures([{ ...valid[0], t: Number.NaN }]), [
        "timeline[0].t: must be a finite number (got NaN)",
    ]);
    assertEquals(failures([{ ...valid[0], dv: { ...dv, prograde: "fast" } }]), [
        'timeline[0].dv.prograde: must be a finite number (got "fast")',
    ]);
    assertEquals(failures([{ ...valid[0], dv: undefined }]), [
        "timeline[0].dv: must be an object (got undefined)",
    ]);
});

Deno.test("validateTimeline checks set-orbit elements like a body's", () => {
    assertEquals(
        failures([{ ...valid[1], elements: { ...elements, a: -1 } }]),
        ["timeline[0].elements.a: must be > 0 (got -1)"],
    );
});

Deno.test("validateTimeline rejects a burn that fails", () => {
    const leaving = {
        ...valid[0],
        dv: { prograde: 1e9, normal: 0, radial: 0 },
    };

    assertEquals(failures([leaving]), [
        `timeline: can't burn "earth" at t=0: the burn would leave the parent's gravity`,
    ]);
});

Deno.test("validateTimeline rejects the root and an unknown body", () => {
    assertEquals(failures([{ ...valid[1], bodyId: "sun" }]), [
        'timeline[0].bodyId: "sun" has no orbit',
    ]);
    assertEquals(failures([{ ...valid[1], bodyId: "nowhere" }]), [
        'timeline[0].bodyId: there is no body "nowhere"',
    ]);
});

Deno.test("validateTimeline treats Object.prototype names as ordinary ids", () => {
    const events = ["__proto__", "constructor"].map(
        (id): TimelineEvent => ({
            type: "burn",
            id,
            bodyId: "earth",
            t: 0,
            dv,
        }),
    );

    assertEquals(check(events), { ok: true, timeline: events });
    assertEquals(failures([events[0], events[0]]), [
        'timeline[1].id: must be unique (got "__proto__")',
    ]);
});

Deno.test("validateTimeline rejects a t that isn't finite", () => {
    for (const t of [Number.NaN, Number.POSITIVE_INFINITY]) {
        assertEquals(failures([{ ...valid[0], t }]), [
            `timeline[0].t: must be a finite number (got ${t})`,
        ]);
    }
});
