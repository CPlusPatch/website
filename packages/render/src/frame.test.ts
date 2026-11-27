/// <reference types="deno" />
import { PRESETS, solarSystem } from "@cpluspatch/catalog";
import {
    bodyOrientation,
    compile,
    documentOf,
    type Scenario,
    sortByDepth,
    worldStates,
} from "@cpluspatch/sim";
import { assert, assertEquals } from "@std/assert";
import {
    type Frame,
    orientationOf,
    positionOf,
    presentIn,
    velocityOf,
} from "./frame.ts";

const T = 7.5e8;

const system = compile(documentOf(solarSystem), PRESETS);
const frame: Frame = { system, snapshot: system.snapshot(T) };
const states = worldStates(solarSystem, sortByDepth(solarSystem), T);

Deno.test("position and velocity match worldStates", () => {
    for (const id of ["sun", "earth", "moon", "iss"]) {
        const state = states.get(id);
        assert(state);

        assertEquals(positionOf(frame, id), state.r);
        assertEquals(velocityOf(frame, id), state.v);
    }
});

Deno.test("orientation matches bodyOrientation", () => {
    for (const id of ["earth", "mars"]) {
        const body = solarSystem.bodies.find(
            (candidate) => candidate.id === id,
        );
        assert(body);

        assertEquals(
            orientationOf(frame, id),
            bodyOrientation(PRESETS[body.preset ?? ""]?.rotation, T),
        );
    }
});

Deno.test("an unknown id gives undefined or null", () => {
    assertEquals(positionOf(frame, "nope"), undefined);
    assertEquals(velocityOf(frame, "nope"), undefined);
    assertEquals(orientationOf(frame, "nope"), null);
});

Deno.test("a body without rotation has no orientation", () => {
    assertEquals(orientationOf(frame, "iss"), null);
});

const orbit = (parent: string, a: number) => ({
    parent,
    elements: { a, e: 0.01, i: 0, raan: 0, argp: 0, m0: 0, epoch: 0 },
});

const lifetimes: Scenario = {
    version: 3,
    name: "lifetimes",
    bodies: [
        { id: "sun", name: "Sun", tags: [], mass: { mu: 1.3e20, radius: 7e8 } },
        {
            id: "planet",
            name: "Planet",
            tags: [],
            mass: { mu: 4e14, radius: 6e6 },
            lifetime: { from: 10, to: 20 },
            orbit: orbit("sun", 1.5e11),
        },
        {
            id: "moon",
            name: "Moon",
            tags: [],
            mass: { mu: 0, radius: 1 },
            orbit: orbit("planet", 4e8),
        },
    ],
};

Deno.test("a body is present in a frame from its lifetime's start until its end, with its ancestors", () => {
    const life = compile(documentOf(lifetimes), PRESETS);
    const at = (t: number): Frame => ({
        system: life,
        snapshot: life.snapshot(t),
    });

    assertEquals(presentIn(at(5), "sun"), true);
    assertEquals(presentIn(at(5), "planet"), false);
    assertEquals(presentIn(at(5), "moon"), false);
    assertEquals(presentIn(at(10), "planet"), true);
    assertEquals(presentIn(at(15), "moon"), true);
    assertEquals(presentIn(at(20), "planet"), false);
    assertEquals(presentIn(at(20), "moon"), false);
});

Deno.test("an unknown id isn't present", () => {
    assertEquals(presentIn(frame, "nope"), false);
});
