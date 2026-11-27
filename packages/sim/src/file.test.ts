/// <reference types="deno" />

import { PRESETS } from "@cpluspatch/catalog";
import type { Elements } from "@cpluspatch/orbit";
import { assert, assertEquals } from "@std/assert";
import type { Document } from "./document.ts";
import { documentOf } from "./document.ts";
import { documentFile, validateDocument } from "./file.ts";
import type { Scenario } from "./scenario.ts";

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
    name: "file",
    bodies: [
        {
            id: "sun",
            name: "Sun",
            tags: ["star"],
            mass: { mu: 1.3e20, radius: 7e8 },
        },
        {
            id: "earth",
            name: "Earth",
            tags: ["planet"],
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
            tags: ["satellite"],
            mass: { mu: 0, radius: 1 },
            orbit: { parent: "earth", elements: base },
        },
    ],
};

const doc: Document = {
    scenario,
    timeline: [
        {
            type: "burn",
            id: "e1",
            bodyId: "sat",
            t: 100,
            dv: { prograde: 50, normal: 10, radial: 0 },
        },
        {
            type: "set-orbit",
            id: "e2",
            bodyId: "sat",
            t: 5000,
            elements: { ...base, a: 8e6, epoch: 5000 },
        },
    ],
};

const options = { presets: PRESETS };

// A file goes through JSON, as it does on disk.
const reload = (value: unknown) =>
    validateDocument(JSON.parse(JSON.stringify(value)), options);

Deno.test("file: a burn and a set-orbit survive a round trip", () => {
    const result = reload(documentFile(doc));

    assert(result.ok);
    assertEquals(result.doc, doc);
});

Deno.test("file: a file without a timeline loads with no events", () => {
    const result = reload(scenario);

    assert(result.ok);
    assertEquals(result.doc, documentOf(scenario));
});

Deno.test("file: an empty timeline is left out", () => {
    const file = documentFile(documentOf(scenario));

    assertEquals("timeline" in file, false);
    assertEquals(file, scenario);
});

Deno.test("file: an invalid event is an error", () => {
    const result = reload({
        ...scenario,
        timeline: [{ type: "burn", id: "e1" }],
    });

    assert(!result.ok);
    assert(result.errors.some((error) => error.startsWith("timeline[0]")));
});

Deno.test("file: a timeline that isn't an array is an error", () => {
    const result = reload({ ...scenario, timeline: {} });

    assert(!result.ok);
});

Deno.test("file: a burn that escapes is an error", () => {
    const runaway = {
        ...doc.timeline[0],
        dv: { prograde: 1e5, normal: 0, radial: 0 },
    };
    const result = reload({ ...scenario, timeline: [runaway] });

    assert(!result.ok);
    assert(result.errors.some((error) => error.includes("leave the parent")));
});

Deno.test("file: an invalid scenario is an error", () => {
    const result = reload({ ...scenario, version: 9 });

    assert(!result.ok);
});

Deno.test("file: a body's lifetime survives a round trip", () => {
    const withLifetime: Document = documentOf({
        ...scenario,
        bodies: scenario.bodies.map((body) =>
            body.id === "sat"
                ? { ...body, lifetime: { from: 10, to: 20 } }
                : body,
        ),
    });
    const result = reload(documentFile(withLifetime));

    assert(result.ok);
    assertEquals(result.doc, withLifetime);
});
