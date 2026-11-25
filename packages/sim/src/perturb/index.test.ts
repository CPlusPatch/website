/// <reference types="deno" />

import { assertEquals } from "@std/assert";
import { bodyOrientation } from "../orientation.ts";
import { j2Precession } from "../precession.ts";
import type { Rotation } from "../rotation/index.ts";
import type { Body, Gravity, OrbitingBody } from "../scenario.ts";
import {
    precessionsByBody,
    precessionsOf,
    resolvePerturbation,
} from "./index.ts";

const rotation: Rotation = {
    type: "uniform",
    pole: { x: 0.2, y: 0.1, z: 0.9 },
    w0: 0,
    rate: 1e-4,
};
const gravity: Gravity = { j2: 1.08e-3, radius: 6.4e6 };

const parent: Body = {
    id: "earth",
    name: "Earth",
    tags: [],
    mass: { mu: 3.986e14, radius: 6.4e6 },
    rotation,
    gravity,
};

const satellite: OrbitingBody = {
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
            epoch: 1e5,
        },
    },
};

Deno.test("a j2 perturbation uses the parent's mu, gravity and pole at the epoch", () => {
    const { elements } = satellite.orbit;
    const axes = bodyOrientation(rotation, elements.epoch);

    if (!axes) throw new Error("No orientation.");

    const expected = j2Precession(
        elements,
        parent.mass.mu,
        gravity.j2,
        gravity.radius,
        axes.z,
    );
    const actual = resolvePerturbation({ type: "j2" }, satellite, parent);

    assertEquals(actual, expected);
    assertEquals(actual.nodeRate < 0, true);
});

Deno.test("a j2 perturbation without parent gravity has zero rates", () => {
    const { gravity: _, ...flat } = parent;

    assertEquals(resolvePerturbation({ type: "j2" }, satellite, flat), {
        pole: { x: 0, y: 0, z: 1 },
        nodeRate: 0,
        argpRate: 0,
    });
});

Deno.test("a j2 perturbation without parent rotation has zero rates", () => {
    const { rotation: _, ...still } = parent;
    const result = resolvePerturbation({ type: "j2" }, satellite, still);

    assertEquals([result.nodeRate, result.argpRate], [0, 0]);
});

Deno.test("a secular perturbation resolves to its stored rates", () => {
    const secular = {
        type: "secular" as const,
        pole: { x: 0, y: 1, z: 0 },
        nodeRate: 2e-9,
        argpRate: -1e-9,
    };

    assertEquals(resolvePerturbation(secular, satellite, parent), {
        pole: secular.pole,
        nodeRate: 2e-9,
        argpRate: -1e-9,
    });
});

Deno.test("precessionsOf keeps the order of the perturbations", () => {
    const secular = {
        type: "secular" as const,
        pole: { x: 0, y: 0, z: 1 },
        nodeRate: 1,
        argpRate: 2,
    };
    const body = {
        ...satellite,
        perturbations: [secular, { type: "j2" as const }],
    };
    const [first, second] = precessionsOf(body, parent);

    assertEquals(first?.nodeRate, 1);
    assertEquals(second, resolvePerturbation({ type: "j2" }, body, parent));
    assertEquals(precessionsOf(satellite, parent), []);
});

Deno.test("precessionsByBody has an entry for each orbiting body and none for the root", () => {
    const resolved = precessionsByBody([parent, satellite]);

    assertEquals([...resolved.keys()], ["sat"]);
    assertEquals(resolved.get("sat"), []);
});
