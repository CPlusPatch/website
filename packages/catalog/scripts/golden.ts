/// <reference types="deno" />

import { unixMsToJ2000s, type Vec3 } from "@cpluspatch/orbit";
import {
    bodyOrientation,
    expandPresets,
    type Scenario,
    sortByDepth,
    validateScenario,
    worldStates,
} from "@cpluspatch/sim";
import { builtInScenarios } from "../src/built-in.ts";
import { PRESETS } from "../src/presets/index.ts";

/** One body in the fixture. `orientation` is the x, y and z axes, nine numbers. */
type GoldenBody = { r: number[]; v: number[]; orientation?: number[] };

/** Bodies by id, by time. */
type Snapshot = Record<string, Record<string, GoldenBody>>;

/** The fixture: snapshots by built-in scenario name, and by payload file name in `fixtures/`. */
type Golden = {
    times: number[];
    scenarios: Record<string, Snapshot>;
    fixtures: Record<string, Snapshot>;
};

const flat = (...vecs: Vec3[]): number[] =>
    vecs.flatMap((vec) => [vec.x, vec.y, vec.z]);

const times = [
    0,
    unixMsToJ2000s(Date.parse("2026-11-24T00:00:00Z")),
    unixMsToJ2000s(Date.parse("2036-11-24T00:00:00Z")),
];

/** The states and orientations of every body of a scenario at each time. */
const snapshot = (scenario: Scenario): Snapshot => {
    const expanded = expandPresets(scenario, PRESETS);
    const order = sortByDepth(expanded);
    const byTime: Snapshot = {};

    for (const t of times) {
        const states = worldStates(expanded, order, t);
        const bodies: Record<string, GoldenBody> = {};

        for (const body of order) {
            const state = states.get(body.id);

            if (!state) {
                throw new Error(`${scenario.name}: no state for ${body.id}`);
            }

            const entry: GoldenBody = { r: flat(state.r), v: flat(state.v) };
            const orientation = bodyOrientation(body.rotation, t);

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

    return byTime;
};

const golden: Golden = { times, scenarios: {}, fixtures: {} };

for (const scenario of builtInScenarios) {
    golden.scenarios[scenario.name] = snapshot(scenario);
}

const fixturesDir = new URL("../src/fixtures/", import.meta.url);

// `readDir` has no order, and the key order has to be the same on every run.
const names = [...Deno.readDirSync(fixturesDir)]
    .map((entry) => entry.name)
    .filter((name) => name.endsWith(".json"))
    .sort();

for (const name of names) {
    const text = await Deno.readTextFile(new URL(name, fixturesDir));
    const result = validateScenario(JSON.parse(text));

    if (!result.ok) {
        throw new Error(`${name}: ${result.errors.join("; ")}`);
    }

    golden.fixtures[name.replace(/\.json$/, "")] = snapshot(result.scenario);
}

await Deno.writeTextFile(
    new URL("../src/golden.json", import.meta.url),
    `${JSON.stringify(golden, null, 4)}\n`,
);
