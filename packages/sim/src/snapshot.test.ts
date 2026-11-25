/// <reference types="deno" />

import { builtInScenarios, PRESETS } from "@cpluspatch/catalog";
import golden from "@cpluspatch/catalog/golden.json" with { type: "json" };
import {
    assert,
    assertEquals,
    assertNotStrictEquals,
    assertStrictEquals,
    assertThrows,
} from "@std/assert";
import { documentOf } from "./document.ts";
import { bodyOrientation } from "./orientation.ts";
import { precessionsOf } from "./perturb/index.ts";
import { elementsAt, precess } from "./precession.ts";
import { expandPresets } from "./presets.ts";
import { isOrbiting, type Scenario, sortByDepth } from "./scenario.ts";
import { compile, statesAt } from "./snapshot.ts";
import { worldStates } from "./system.ts";

const TIMES = [...golden.times, -3.15576e9, 123_456_789.5];

for (const scenario of builtInScenarios) {
    Deno.test(`snapshot: ${scenario.name} matches worldStates and bodyOrientation exactly`, () => {
        const system = compile(documentOf(scenario), PRESETS);
        const expanded = expandPresets(scenario, PRESETS);
        const order = sortByDepth(expanded);

        for (const t of TIMES) {
            const snapshot = system.snapshot(t);
            const states = worldStates(expanded, order, t);

            assertEquals(snapshot.t, t);
            assertEquals(snapshot.r.length, 3 * order.length);
            assertEquals(snapshot.v.length, 3 * order.length);
            assertEquals(snapshot.orientation.length, 9 * order.length);

            for (const [i, body] of order.entries()) {
                const label = `${scenario.name} ${body.id} at ${t}`;
                const state = states.get(body.id);

                assert(state, `${label}: no state`);

                assertEquals(
                    [...snapshot.r.subarray(3 * i, 3 * i + 3)],
                    [state.r.x, state.r.y, state.r.z],
                    `${label}: r`,
                );
                assertEquals(
                    [...snapshot.v.subarray(3 * i, 3 * i + 3)],
                    [state.v.x, state.v.y, state.v.z],
                    `${label}: v`,
                );

                const actual = [
                    ...snapshot.orientation.subarray(9 * i, 9 * i + 9),
                ];
                const orientation = bodyOrientation(body.rotation, t);
                const expected = orientation
                    ? [orientation.x, orientation.y, orientation.z].flatMap(
                          (axis) => [axis.x, axis.y, axis.z],
                      )
                    : Array.from({ length: 9 }, () => Number.NaN);

                assertEquals(actual, expected, `${label}: orientation`);
            }
        }
    });

    Deno.test(`snapshot: ${scenario.name} lists parents before children and index inverts ids`, () => {
        const system = compile(documentOf(scenario), PRESETS);

        assertEquals(
            [...system.ids].sort(),
            scenario.bodies.map((body) => body.id).sort(),
        );

        for (const [i, id] of system.ids.entries()) {
            assertEquals(system.index.get(id), i);
        }

        for (const body of scenario.bodies) {
            if (!isOrbiting(body)) {
                continue;
            }

            const child = system.index.get(body.id);
            const parent = system.index.get(body.orbit.parent);

            assert(child !== undefined && parent !== undefined, body.id);
            assert(parent < child, `${body.id} comes before its parent`);
        }
    });
}

const scenario = builtInScenarios[0];

assert(scenario, "no built-in scenario");

Deno.test("snapshot returns the same object for the same time and a new one for another", () => {
    const system = compile(documentOf(scenario), PRESETS);
    const first = system.snapshot(100);

    assertStrictEquals(system.snapshot(100), first);
    assertNotStrictEquals(system.snapshot(200), first);
});

Deno.test("snapshot has no clouds yet", () => {
    assertEquals(
        compile(documentOf(scenario), PRESETS).snapshot(0).clouds.size,
        0,
    );
});

Deno.test("elementsAt matches the precession module for an orbiting body", () => {
    const system = compile(documentOf(scenario), PRESETS);

    for (const body of scenario.bodies) {
        if (!isOrbiting(body)) {
            continue;
        }

        const parent = scenario.bodies.find(
            (candidate) => candidate.id === body.orbit.parent,
        );
        assert(parent, `no parent for ${body.id}`);

        for (const t of TIMES) {
            assertEquals(
                system.elementsAt(body.id, t),
                elementsAt(body.orbit.elements, precessionsOf(body, parent), t),
            );
        }
    }
});

Deno.test("elementsAt throws for the root body", () => {
    const root = scenario.bodies.find((body) => body.orbit === undefined);

    assert(root, "no root body");
    assertThrows(
        () => compile(documentOf(scenario), PRESETS).elementsAt(root.id, 0),
        Error,
        "root",
    );
});

Deno.test("elementsAt throws for an unknown id", () => {
    assertThrows(
        () =>
            compile(documentOf(scenario), PRESETS).elementsAt(
                "no-such-body",
                0,
            ),
        Error,
        "Unknown body",
    );
});

Deno.test("statesAt holds the worldStates of every body", () => {
    const system = compile(documentOf(scenario), PRESETS);
    const order = sortByDepth(scenario);

    for (const t of TIMES) {
        assertEquals(statesAt(system, t), worldStates(scenario, order, t));
    }
});

const j2Earth = (): Scenario => ({
    version: 3,
    name: "j2",
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
                elements: {
                    a: 1.5e11,
                    e: 0.0167,
                    i: 0,
                    raan: 0,
                    argp: 0,
                    m0: 0,
                    epoch: 0,
                },
            },
        },
        {
            id: "sat",
            name: "Sat",
            tags: [],
            mass: { mu: 0, radius: 1 },
            orbit: {
                parent: "earth",
                elements: {
                    a: 7e6,
                    e: 0.01,
                    i: 0.9,
                    raan: 0.3,
                    argp: 0.2,
                    m0: 0,
                    epoch: 0,
                },
            },
            perturbations: [{ type: "j2" }],
        },
    ],
});

Deno.test("a j2 body under a preset parent compiles and precesses by the j2 rates", () => {
    const system = compile(documentOf(j2Earth()), PRESETS);
    const earth = system.body("earth");
    const [precession] = system.precessions("sat");

    assert(precession);
    assert(earth.gravity);
    assert(precession.nodeRate !== 0);

    const sat = system.body("sat");
    assert(isOrbiting(sat));

    const t = 5e6;

    assertEquals(
        system.elementsAt("sat", t),
        precess(sat.orbit.elements, precession, t),
    );
    assertEquals(system.precessions("sun" as string).length, 0);
});

Deno.test("system.precessions and system.body throw for an unknown id", () => {
    const system = compile(documentOf(j2Earth()), PRESETS);

    assertThrows(() => system.precessions("nope"), Error, "Unknown body");
    assertThrows(() => system.body("nope"), Error, "Unknown body");
});
