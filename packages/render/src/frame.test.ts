/// <reference types="deno" />
import { PRESETS, solarSystem } from "@cpluspatch/catalog";
import {
    bodyOrientation,
    compile,
    documentOf,
    sortByDepth,
    worldStates,
} from "@cpluspatch/sim";
import { assert, assertEquals } from "@std/assert";
import { type Frame, orientationOf, positionOf, velocityOf } from "./frame.ts";

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
