/// <reference types="deno" />
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import { elementsFromState, nextApsisTime, reepoch } from "./elements.ts";
import { assertVecClose, MU, mulberry32, randomElements } from "./fixture.ts";
import type { Elements } from "./kepler.ts";
import { meanAnomalyAt, stateAt, wrapAngle } from "./kepler.ts";

const roundTrip = (el: Elements, t: number): void => {
    const state = stateAt(el, MU, t);
    const result = elementsFromState(state.r, state.v, MU, t);

    assert(result.ok, "expected elements");

    const again = stateAt(result.elements, MU, t);

    assertVecClose(again.r, state.r);
    assertVecClose(again.v, state.v);
};

const base: Elements = {
    a: 2e7,
    e: 0.3,
    i: 0.5,
    raan: 1,
    argp: 2,
    m0: 3,
    epoch: 0,
};

Deno.test("state to elements to state round-trips on random orbits", () => {
    const rand = mulberry32(3);

    for (let k = 0; k < 200; k++) {
        roundTrip(randomElements(rand), rand() * 1e6);
    }
});

Deno.test("the round trip holds for special orbits", () => {
    roundTrip({ ...base, e: 0 }, 0);
    roundTrip({ ...base, e: 1e-12 }, 0);
    roundTrip({ ...base, i: 0 }, 0);
    roundTrip({ ...base, i: Math.PI }, 0);
    roundTrip({ ...base, e: 0, i: 0 }, 0);
    roundTrip({ ...base, e: 0, i: Math.PI }, 0);
});

Deno.test("the recovered elements match the originals on a generic orbit", () => {
    const state = stateAt(base, MU, 0);
    const result = elementsFromState(state.r, state.v, MU, 0);

    assert(result.ok);
    assertAlmostEquals(result.elements.a / base.a, 1, 1e-9);
    assertAlmostEquals(result.elements.e, base.e, 1e-9);
    assertAlmostEquals(result.elements.i, base.i, 1e-9);
    assertAlmostEquals(result.elements.raan, base.raan, 1e-9);
    assertAlmostEquals(result.elements.argp, base.argp, 1e-9);
    assertAlmostEquals(result.elements.m0, base.m0, 1e-9);
});

Deno.test("hyperbolic and parabolic states have no elliptic elements", () => {
    const r = { x: 7e6, y: 0, z: 0 };
    const escapeSpeed = Math.sqrt((2 * MU) / 7e6);

    assertEquals(
        elementsFromState(r, { x: 0, y: 12e3 + escapeSpeed, z: 0 }, MU, 0),
        {
            ok: false,
            reason: "escape",
        },
    );
    assertEquals(elementsFromState(r, { x: 0, y: escapeSpeed, z: 0 }, MU, 0), {
        ok: false,
        reason: "escape",
    });
});

Deno.test("a purely radial velocity is degenerate", () => {
    assertEquals(
        elementsFromState(
            { x: 7e6, y: 0, z: 0 },
            { x: 1000, y: 0, z: 0 },
            MU,
            0,
        ),
        { ok: false, reason: "degenerate" },
    );
});

Deno.test("a state at rest is degenerate", () => {
    assertEquals(
        elementsFromState({ x: 7e6, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, MU, 0),
        { ok: false, reason: "degenerate" },
    );
});

Deno.test("equatorial orbits get a zero node and circular ones a zero periapsis", () => {
    for (const i of [0, Math.PI]) {
        const el = { ...base, e: 0, i };
        const state = stateAt(el, MU, 0);
        const result = elementsFromState(state.r, state.v, MU, 0);

        assert(result.ok);
        assertAlmostEquals(result.elements.i, i, 1e-9);
        assertEquals(result.elements.raan, 0);
        assertEquals(result.elements.argp, 0);
    }
});

Deno.test("reepoch keeps the state at the new epoch", () => {
    const moved = reepoch(base, MU, 5e4);
    const before = stateAt(base, MU, 5e4);
    const after = stateAt(moved, MU, 5e4);

    assertEquals(moved.epoch, 5e4);
    assertVecClose(after.r, before.r);
    assertVecClose(after.v, before.v);
});

Deno.test("nextApsisTime lands on the apsis, after the given time", () => {
    const rand = mulberry32(4);

    for (let k = 0; k < 50; k++) {
        const el = randomElements(rand);
        const t = rand() * 1e7;

        for (const [apsis, target] of [
            ["periapsis", 0],
            ["apoapsis", Math.PI],
        ] as const) {
            const next = nextApsisTime(el, MU, t, apsis);
            const m = meanAnomalyAt(el, MU, next);
            const distance = Math.abs(
                wrapAngle(m - target + Math.PI) - Math.PI,
            );

            assert(next > t);
            assert(distance < 1e-6, `${apsis}: off by ${distance}`);
        }
    }
});

Deno.test("nextApsisTime from periapsis itself waits a full period", () => {
    const el = { ...base, m0: 0 };
    const next = nextApsisTime(el, MU, 0, "periapsis");

    assertAlmostEquals(next * Math.sqrt(MU / el.a ** 3), 2 * Math.PI, 1e-9);
});
