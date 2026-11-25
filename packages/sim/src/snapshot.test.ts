/// <reference types="deno" />

import { builtInScenarios } from "@cpluspatch/catalog";
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
import { elementsAt } from "./precession.ts";
import { isOrbiting, sortByDepth } from "./scenario.ts";
import { compile, statesAt } from "./snapshot.ts";
import { worldStates } from "./system.ts";

const TIMES = [...golden.times, -3.15576e9, 123_456_789.5];

for (const scenario of builtInScenarios) {
    Deno.test(`snapshot: ${scenario.name} matches worldStates and bodyOrientation exactly`, () => {
        const system = compile(documentOf(scenario));
        const order = sortByDepth(scenario);

        for (const t of TIMES) {
            const snapshot = system.snapshot(t);
            const states = worldStates(scenario, order, t);

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
                const orientation = bodyOrientation(body.model, t);
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
        const system = compile(documentOf(scenario));

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
    const system = compile(documentOf(scenario));
    const first = system.snapshot(100);

    assertStrictEquals(system.snapshot(100), first);
    assertNotStrictEquals(system.snapshot(200), first);
});

Deno.test("snapshot has no clouds yet", () => {
    assertEquals(compile(documentOf(scenario)).snapshot(0).clouds.size, 0);
});

Deno.test("elementsAt matches the precession module for an orbiting body", () => {
    const system = compile(documentOf(scenario));

    for (const body of scenario.bodies) {
        if (!isOrbiting(body)) {
            continue;
        }

        for (const t of TIMES) {
            assertEquals(system.elementsAt(body.id, t), elementsAt(body, t));
        }
    }
});

Deno.test("elementsAt throws for the root body", () => {
    const root = scenario.bodies.find((body) => body.orbit === undefined);

    assert(root, "no root body");
    assertThrows(
        () => compile(documentOf(scenario)).elementsAt(root.id, 0),
        Error,
        "root",
    );
});

Deno.test("elementsAt throws for an unknown id", () => {
    assertThrows(
        () => compile(documentOf(scenario)).elementsAt("no-such-body", 0),
        Error,
        "Unknown body",
    );
});

Deno.test("statesAt holds the worldStates of every body", () => {
    const system = compile(documentOf(scenario));
    const order = sortByDepth(scenario);

    for (const t of TIMES) {
        assertEquals(statesAt(system, t), worldStates(scenario, order, t));
    }
});
