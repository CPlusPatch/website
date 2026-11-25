/// <reference types="deno" />

import type { Vec3 } from "@cpluspatch/orbit";
import {
    bodyOrientation,
    expandPresets,
    type Scenario,
    sortByDepth,
    validateScenario,
    worldStates,
} from "@cpluspatch/sim";
import { assert, assertEquals } from "@std/assert";
import { builtInScenarios } from "./built-in.ts";
import editedV2 from "./fixtures/edited-v2.json" with { type: "json" };
import kerbolV2 from "./fixtures/kerbol-v2.json" with { type: "json" };
import solarSystemV2 from "./fixtures/solar-system-v2.json" with {
    type: "json",
};
import v1 from "./fixtures/v1.json" with { type: "json" };
import golden from "./golden.json" with { type: "json" };
import { PRESETS } from "./presets/index.ts";

const R_TOLERANCE = 1;
const V_TOLERANCE = 1e-6;
const AXIS_TOLERANCE = 1e-9;

// NaN defaults make a short fixture array fail the comparison.
const distance = (expected: number[], actual: Vec3): number => {
    const [x = Number.NaN, y = Number.NaN, z = Number.NaN] = expected;

    return Math.hypot(x - actual.x, y - actual.y, z - actual.z);
};

type GoldenBody = { r: number[]; v: number[]; orientation?: number[] };

type Snapshot = Record<string, Record<string, GoldenBody>>;

const scenarios: Record<string, Snapshot> = golden.scenarios;

const fixtures: Record<string, Snapshot> = golden.fixtures;

const compare = (
    scenario: Scenario,
    expectedTimes: Snapshot | undefined,
): void => {
    assert(expectedTimes, `no fixture for ${scenario.name}`);
    assertEquals(Object.keys(expectedTimes).length, golden.times.length);

    const expanded = expandPresets(scenario, PRESETS);
    const order = sortByDepth(expanded);

    for (const t of golden.times) {
        const expectedBodies = expectedTimes[String(t)];

        assert(expectedBodies, `no fixture for ${scenario.name} at ${t}`);

        const states = worldStates(expanded, order, t);

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

            assert(distance(expected.r, state.r) <= R_TOLERANCE, `${label}: r`);
            assert(distance(expected.v, state.v) <= V_TOLERANCE, `${label}: v`);

            const orientation = bodyOrientation(body.rotation, t);

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

                assertEquals(axes.length, expected.orientation.length, label);

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
};

for (const scenario of builtInScenarios) {
    Deno.test(`golden: ${scenario.name} matches the fixture`, () => {
        compare(scenario, scenarios[scenario.name]);
    });
}

// Each payload is what a share link or saved copy held when the file was frozen.
const payloads = {
    "solar-system-v2": solarSystemV2,
    "kerbol-v2": kerbolV2,
    "edited-v2": editedV2,
    v1,
};

for (const [name, payload] of Object.entries(payloads)) {
    Deno.test(`golden: the frozen ${name} payload still loads to the same states`, () => {
        const result = validateScenario(payload);

        assert(
            result.ok,
            `${name}: ${result.ok ? "" : result.errors.join("; ")}`,
        );

        compare(result.scenario, fixtures[name]);
    });
}
