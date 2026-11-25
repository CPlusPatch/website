/// <reference types="deno" />

import { unixMsToJ2000s, type Vec3 } from "@cpluspatch/orbit";
import { bodyOrientation, sortByDepth, worldStates } from "@cpluspatch/sim";
import { builtInScenarios } from "../src/built-in.ts";

/** One body in the fixture. `orientation` is the x, y and z axes, nine numbers. */
type GoldenBody = { r: number[]; v: number[]; orientation?: number[] };

/** The fixture: bodies by id, by time, by scenario name. */
type Golden = {
    times: number[];
    scenarios: Record<string, Record<string, Record<string, GoldenBody>>>;
};

const flat = (...vecs: Vec3[]): number[] =>
    vecs.flatMap((vec) => [vec.x, vec.y, vec.z]);

const times = [
    0,
    unixMsToJ2000s(Date.parse("2026-11-24T00:00:00Z")),
    unixMsToJ2000s(Date.parse("2036-11-24T00:00:00Z")),
];

const golden: Golden = { times, scenarios: {} };

for (const scenario of builtInScenarios) {
    const order = sortByDepth(scenario);
    const byTime: Record<string, Record<string, GoldenBody>> = {};

    for (const t of times) {
        const states = worldStates(scenario, order, t);
        const bodies: Record<string, GoldenBody> = {};

        for (const body of order) {
            const state = states.get(body.id);

            if (!state) {
                throw new Error(`${scenario.name}: no state for ${body.id}`);
            }

            const entry: GoldenBody = { r: flat(state.r), v: flat(state.v) };
            const orientation = bodyOrientation(body.model, t);

            if (orientation) {
                entry.orientation = flat(
                    orientation.x,
                    orientation.y,
                    orientation.z,
                );
            }

            bodies[body.id] = entry;
        }

        byTime[String(t)] = bodies;
    }

    golden.scenarios[scenario.name] = byTime;
}

await Deno.writeTextFile(
    new URL("../src/golden.json", import.meta.url),
    `${JSON.stringify(golden, null, 4)}\n`,
);
