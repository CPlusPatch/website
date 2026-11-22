/// <reference types="deno" />
import { assert, assertEquals } from "@std/assert";
import { solarSystem } from "./data/solar-system.ts";
import { assertVecClose } from "./fixture.ts";
import { stateAt } from "./kepler.ts";
import type { Body } from "./scenario.ts";
import { sortByDepth } from "./scenario.ts";
import { worldStates } from "./system.ts";
import { add, length, sub } from "./vec.ts";

const order = sortByDepth(solarSystem);
const t = 7.5e8;

const find = (id: string) => {
    const body = solarSystem.bodies.find((b) => b.id === id);

    assert(body, `no body ${id}`);

    return body;
};

Deno.test("the root is at the origin with zero velocity", () => {
    const sun = worldStates(solarSystem, order, t).get("sun");

    assertEquals(sun, { r: { x: 0, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 } });
});

Deno.test("a moon's world state is its parent's plus its own orbit", () => {
    const states = worldStates(solarSystem, order, t);
    const earth = find("earth");
    const moon = find("moon");
    const earthState = states.get("earth");
    const moonState = states.get("moon");
    const local =
        moon.elements && stateAt(moon.elements, earth.mu + moon.mu, t);

    assert(earthState && moonState && local);
    assertVecClose(moonState.r, add(earthState.r, local.r));
    assertVecClose(moonState.v, add(earthState.v, local.v));
});

Deno.test("every body gets a state", () => {
    assertEquals(
        worldStates(solarSystem, order, t).size,
        solarSystem.bodies.length,
    );
});

Deno.test("a precessing body's state follows its precessed orbit", () => {
    const moon = find("moon");
    const precessing: Body = {
        ...moon,
        precession: {
            pole: { x: 0, y: 0, z: 1 },
            nodeRate: -1e-6,
            argpRate: 0,
        },
    };
    const scenario = {
        ...solarSystem,
        bodies: solarSystem.bodies.map((b) => (b === moon ? precessing : b)),
    };
    const plain = worldStates(solarSystem, order, t).get("moon");
    const turned = worldStates(scenario, sortByDepth(scenario), t).get("moon");

    assert(plain && turned);
    assert(length(sub(plain.r, turned.r)) > 1e6);
});
