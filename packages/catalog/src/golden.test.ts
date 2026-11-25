/// <reference types="deno" />

import type { Vec3 } from "@cpluspatch/orbit";
import { bodyOrientation, sortByDepth, worldStates } from "@cpluspatch/sim";
import { assert, assertEquals } from "@std/assert";
import { builtInScenarios } from "./built-in.ts";
import golden from "./golden.json" with { type: "json" };

const R_TOLERANCE = 1;
const V_TOLERANCE = 1e-6;
const AXIS_TOLERANCE = 1e-9;

// NaN defaults make a short fixture array fail the comparison.
const distance = (expected: number[], actual: Vec3): number => {
    const [x = Number.NaN, y = Number.NaN, z = Number.NaN] = expected;

    return Math.hypot(x - actual.x, y - actual.y, z - actual.z);
};

const scenarios: Record<
    string,
    Record<string, Record<string, GoldenBody>>
> = golden.scenarios;

type GoldenBody = { r: number[]; v: number[]; orientation?: number[] };

for (const scenario of builtInScenarios) {
    Deno.test(`golden: ${scenario.name} matches the fixture`, () => {
        const expectedTimes = scenarios[scenario.name];

        assert(expectedTimes, `no fixture for ${scenario.name}`);
        assertEquals(Object.keys(expectedTimes).length, golden.times.length);

        const order = sortByDepth(scenario);

        for (const t of golden.times) {
            const expectedBodies = expectedTimes[String(t)];

            assert(expectedBodies, `no fixture for ${scenario.name} at ${t}`);

            const states = worldStates(scenario, order, t);

            assertEquals(
                [...states.keys()].sort(),
                Object.keys(expectedBodies).sort(),
                `${scenario.name} at ${t}: body ids`,
            );

            for (const body of order) {
                const label = `${scenario.name} ${body.id} at ${t}`;
                const expected = expectedBodies[body.id];
                const state = states.get(body.id);

                assert(expected, `${label}: not in the fixture`);
                assert(state, `${label}: no state`);

                assert(
                    distance(expected.r, state.r) <= R_TOLERANCE,
                    `${label}: r`,
                );
                assert(
                    distance(expected.v, state.v) <= V_TOLERANCE,
                    `${label}: v`,
                );

                const orientation = bodyOrientation(body.model, t);

                assertEquals(
                    expected.orientation !== undefined,
                    orientation !== null,
                    label,
                );

                if (expected.orientation && orientation) {
                    const axes = [
                        orientation.x,
                        orientation.y,
                        orientation.z,
                    ].flatMap((axis) => [axis.x, axis.y, axis.z]);

                    assertEquals(
                        axes.length,
                        expected.orientation.length,
                        label,
                    );

                    for (const [
                        i,
                        expectedValue,
                    ] of expected.orientation.entries()) {
                        const value = axes[i] ?? Number.NaN;

                        assert(
                            Math.abs(value - expectedValue) <= AXIS_TOLERANCE,
                            `${label}: orientation[${i}]`,
                        );
                    }
                }
            }
        }
    });
}
