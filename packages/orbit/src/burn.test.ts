/// <reference types="deno" />
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import { applyBurn } from "./burn.ts";
import { assertVecClose, MU } from "./fixture.ts";
import type { Elements } from "./kepler.ts";
import { apoapsis, periapsis, stateAt } from "./kepler.ts";
import { cross, dot, length } from "./vec.ts";

const circular: Elements = {
    a: 7e6,
    e: 0,
    i: 0.5,
    raan: 1,
    argp: 0,
    m0: 2,
    epoch: 0,
};
const speed = Math.sqrt(MU / circular.a);

Deno.test("a zero burn leaves the state unchanged", () => {
    const el = { ...circular, e: 0.2, argp: 1 };
    const result = applyBurn(el, MU, 1000, {
        prograde: 0,
        normal: 0,
        radial: 0,
    });
    const before = stateAt(el, MU, 1000);

    assert(result.ok);

    const after = stateAt(result.elements, MU, 1000);

    assertVecClose(after.r, before.r);
    assertVecClose(after.v, before.v);
});

Deno.test("a prograde burn on a circular orbit raises the apoapsis and keeps the periapsis", () => {
    const dv = 0.1 * speed;
    const result = applyBurn(circular, MU, 0, {
        prograde: dv,
        normal: 0,
        radial: 0,
    });

    assert(result.ok);
    assert(apoapsis(result.elements) > circular.a * 1.1);
    assertAlmostEquals(periapsis(result.elements) / circular.a, 1, 1e-9);
    assertAlmostEquals(
        result.elements.a / (1 / (2 / circular.a - (speed + dv) ** 2 / MU)),
        1,
        1e-9,
    );
});

Deno.test("a normal burn on a circular orbit tilts the plane by atan(dv / v)", () => {
    const dv = 0.2 * speed;
    const { r, v } = stateAt(circular, MU, 0);
    const result = applyBurn(circular, MU, 0, {
        prograde: 0,
        normal: dv,
        radial: 0,
    });

    assert(result.ok);

    const after = stateAt(result.elements, MU, 0);
    const h = cross(r, v);
    const h2 = cross(after.r, after.v);
    const tilt = Math.acos(dot(h, h2) / (length(h) * length(h2)));

    assertAlmostEquals(tilt, Math.atan(dv / speed), 1e-9);
    assertAlmostEquals(
        result.elements.a /
            (1 / (2 / circular.a - (speed ** 2 + dv ** 2) / MU)),
        1,
        1e-9,
    );
});

Deno.test("a burn past escape speed has no elliptic orbit", () => {
    const result = applyBurn(circular, MU, 0, {
        prograde: speed,
        normal: 0,
        radial: 0,
    });

    assert(!result.ok);
    assertEquals(result.reason, "escape");
});
