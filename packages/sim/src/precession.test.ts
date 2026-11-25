/// <reference types="deno" />

import { solarSystem } from "@cpluspatch/catalog";
import {
    axes,
    cross,
    DAY,
    dot,
    type Elements,
    normalize,
    orbitPoints,
    rotate,
    stateAt,
    wrapAngle,
} from "@cpluspatch/orbit";
import { assertVecClose, MU, pointAt } from "@cpluspatch/orbit/fixture";
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import type { Precession } from "./precession.ts";
import {
    elementsAt,
    j2Precession,
    precess,
    precessionTurns,
} from "./precession.ts";
import type { OrbitingBody } from "./scenario.ts";

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

const orbiting: OrbitingBody = {
    id: "probe",
    name: "Probe",
    tags: ["moon"],
    mass: { mu: 0, radius: 1 },
    orbit: { parent: "earth", elements: el },
};

Deno.test("elementsAt returns the elements as they are without perturbations", () => {
    assertEquals(elementsAt(orbiting, 1e9), el);
});

Deno.test("elementsAt precesses the elements when the body has a secular perturbation", () => {
    const precession: Precession = {
        pole: { x: 0, y: 0, z: 1 },
        nodeRate: 1e-7,
        argpRate: 0,
    };
    const body = {
        ...orbiting,
        perturbations: [{ type: "secular" as const, ...precession }],
    };

    assertEquals(elementsAt(body, 1e9), precess(el, precession, 1e9));
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

Deno.test("turning the epoch orbit by the precession turns gives the precessed orbit", () => {
    const eccentric: Elements = { ...el, e: 0.4, i: 0.9 };
    const p: Precession = {
        pole: normalize({ x: 0.3, y: -0.2, z: 0.9 }),
        nodeRate: -4e-9,
        argpRate: 7e-9,
    };
    const t = eccentric.epoch + 30 * 365.25 * 86400;
    const [about, turn] = precessionTurns(eccentric, p, t);

    const epoch = orbitPoints(eccentric, 64);
    const expected = orbitPoints(precess(eccentric, p, t), 64);

    for (let k = 0; k < 64; k++) {
        const point = pointAt(epoch, k);
        const turned = rotate(
            rotate(point, about.axis, about.angle),
            turn.axis,
            turn.angle,
        );

        assertVecClose(turned, pointAt(expected, k), 1e-6);
    }
});

const satelliteRates = (id: string) => {
    const body = solarSystem.bodies.find((b) => b.id === id);
    const precession = body?.perturbations?.[0];

    assert(precession, `${id} has no perturbations`);

    const perDay = (rate: number) => (rate * DAY * 180) / Math.PI;

    return {
        node: perDay(precession.nodeRate),
        argp: perDay(precession.argpRate),
    };
};

Deno.test("the ISS node regresses about 5 degrees a day", () => {
    assertAlmostEquals(satelliteRates("iss").node, -5.0, 0.2);
});

Deno.test("Landsat 9's node advances with the Sun, 0.9856 degrees a day", () => {
    assertAlmostEquals(satelliteRates("landsat-9").node, 0.9856, 0.03);
});

Deno.test("Meridian 10 is near the critical inclination, so its periapsis barely turns", () => {
    assertAlmostEquals(satelliteRates("meridian-10").argp, 0, 0.05);
});

Deno.test("GOES-19's node regresses by a small amount", () => {
    const { node } = satelliteRates("goes-19");

    assert(node < 0 && node > -0.05, `node rate is ${node} degrees a day`);
});

Deno.test("j2Precession leaves a polar orbit's node still and turns its periapsis back", () => {
    const polar: Elements = {
        ...el,
        a: 7e6,
        e: 0,
        i: Math.PI / 2,
        raan: 0,
        argp: 0,
    };
    const pole = { x: 0, y: 0, z: 1 };
    const { nodeRate, argpRate } = j2Precession(polar, MU, 1e-3, 6.4e6, pole);

    assertAlmostEquals(nodeRate, 0, 1e-15);
    assert(argpRate < 0);
});
