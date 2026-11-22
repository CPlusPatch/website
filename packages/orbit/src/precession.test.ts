/// <reference types="deno" />
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import { assertVecClose, MU } from "./fixture.ts";
import type { Elements } from "./kepler.ts";
import { axes, stateAt, wrapAngle } from "./kepler.ts";
import type { Precession } from "./precession.ts";
import { elementsAt, precess } from "./precession.ts";
import type { Body } from "./scenario.ts";
import { cross, dot, normalize } from "./vec.ts";

const el: Elements = {
    a: 4e8,
    e: 0.1,
    i: 0.4,
    raan: 1,
    argp: 2,
    m0: 3,
    epoch: 100,
};

const normalOf = (e: Elements) => {
    const { p, q } = axes(e);

    return cross(p, q);
};

Deno.test("zero rates give the same elements", () => {
    const p: Precession = {
        pole: normalize({ x: 1, y: 2, z: 3 }),
        nodeRate: 0,
        argpRate: 0,
    };
    const after = precess(el, p, 1e9);

    for (const key of Object.keys(el) as (keyof Elements)[]) {
        assertAlmostEquals(after[key], el[key], 1e-12);
    }
});

Deno.test("about the ecliptic pole the node and periapsis turn at their rates", () => {
    const p: Precession = {
        pole: { x: 0, y: 0, z: 1 },
        nodeRate: -2e-8,
        argpRate: 5e-8,
    };
    const dt = 3e7;
    const after = precess(el, p, el.epoch + dt);

    assertAlmostEquals(after.i, el.i, 1e-12);
    assertAlmostEquals(after.raan, wrapAngle(el.raan + p.nodeRate * dt), 1e-12);
    assertAlmostEquals(after.argp, wrapAngle(el.argp + p.argpRate * dt), 1e-12);
    assertEquals(after.a, el.a);
    assertEquals(after.e, el.e);
    assertEquals(after.m0, el.m0);
    assertEquals(after.epoch, el.epoch);
});

Deno.test("about a tilted pole the normal keeps its angle to the pole", () => {
    const p: Precession = {
        pole: normalize({ x: 0.3, y: -0.2, z: 0.9 }),
        nodeRate: 1e-7,
        argpRate: -3e-8,
    };
    const before = dot(normalOf(el), p.pole);

    for (const dt of [1e6, 1e8, 3e9]) {
        const after = precess(el, p, el.epoch + dt);

        assertAlmostEquals(dot(normalOf(after), p.pole), before, 1e-9);
    }
});

Deno.test("at the epoch the state is the unprecessed state", () => {
    const p: Precession = {
        pole: normalize({ x: 0.3, y: -0.2, z: 0.9 }),
        nodeRate: 1e-7,
        argpRate: -3e-8,
    };
    const now = precess(el, p, el.epoch);
    const expected = stateAt(el, MU, 5e6);
    const actual = stateAt(now, MU, 5e6);

    assertVecClose(actual.r, expected.r);
    assertVecClose(actual.v, expected.v);
});

Deno.test("an orbit that precesses onto the ecliptic keeps a node on +x", () => {
    const flat: Elements = { ...el, i: 0, raan: 0, argp: 1 };
    const p: Precession = {
        pole: { x: 0, y: 0, z: 1 },
        nodeRate: 1e-7,
        argpRate: 0,
    };
    const after = precess(flat, p, flat.epoch + 1e7);

    assertEquals(after.i, 0);
    assertEquals(after.raan, 0);
    assertAlmostEquals(after.argp, wrapAngle(1 + 1e-7 * 1e7), 1e-12);
});

Deno.test("elementsAt returns the elements as they are without precession", () => {
    const body = { elements: el } as Body;

    assertEquals(elementsAt(body, 1e9), el);
    assertEquals(elementsAt({ elements: null } as Body, 1e9), null);
});

Deno.test("elementsAt precesses the elements when the body has a precession", () => {
    const precession: Precession = {
        pole: { x: 0, y: 0, z: 1 },
        nodeRate: 1e-7,
        argpRate: 0,
    };
    const body = { elements: el, precession } as Body;

    assertEquals(elementsAt(body, 1e9), precess(el, precession, 1e9));
});

Deno.test("elementsAt is null for a body with no orbit", () => {
    assert(elementsAt({ elements: null } as Body, 0) === null);
});

Deno.test("a quarter turn about +x turns periapsis first, then the node", () => {
    const p: Precession = {
        pole: { x: 1, y: 0, z: 0 },
        nodeRate: 1e-8,
        argpRate: 1e-8,
    };
    const dt = Math.PI / 2 / 1e-8;
    // A quarter turn about +x maps (x, y, z) to (x, -z, y).
    const turn = ({ x, y, z }: { x: number; y: number; z: number }) => ({
        x,
        y: -z,
        z: y,
    });
    const before = axes(el);
    const after = axes(precess(el, p, el.epoch + dt));

    // The periapsis turns a quarter about the normal, onto q, before the node turn.
    assertVecClose(after.p, turn(before.q), 1e-9);
    assertVecClose(cross(after.p, after.q), turn(normalOf(el)), 1e-9);
});

Deno.test("a retrograde orbit keeps its inclination as its node turns", () => {
    const retro: Elements = { ...el, i: 2.7 };
    const p: Precession = {
        pole: { x: 0, y: 0, z: 1 },
        nodeRate: 3e-8,
        argpRate: -1e-8,
    };
    const dt = 2e7;
    const after = precess(retro, p, retro.epoch + dt);

    assertAlmostEquals(after.i, retro.i, 1e-12);
    assertAlmostEquals(
        after.raan,
        wrapAngle(retro.raan + p.nodeRate * dt),
        1e-12,
    );
    assertAlmostEquals(
        after.argp,
        wrapAngle(retro.argp + p.argpRate * dt),
        1e-12,
    );
});
