/// <reference types="deno" />
import { PRESETS, solarSystem } from "@cpluspatch/catalog";
import type { Elements } from "@cpluspatch/orbit";
import { compile, documentOf } from "@cpluspatch/sim";
import {
    assert,
    assertAlmostEquals,
    assertEquals,
    assertThrows,
} from "@std/assert";
import {
    failureMessage,
    isZero,
    nudge,
    predict,
    previewBurn,
    STEPS,
    sameElements,
} from "./burning.ts";

const MU = 3.986004418e14;
const RADIUS = 6.371e6;
const EL: Elements = {
    a: 8e6,
    e: 0.25,
    i: 0.5,
    raan: 1,
    argp: 2,
    m0: 3,
    epoch: 1e6,
};

Deno.test("the step choices are 1, 10 and 100 m/s", () => {
    assertEquals([...STEPS], [1, 10, 100]);
});

Deno.test("a burn is zero only when all three parts are", () => {
    assertEquals(isZero({ prograde: 0, normal: 0, radial: 0 }), true);
    assertEquals(isZero({ prograde: 0, normal: -0, radial: 0 }), true);
    assertEquals(isZero({ prograde: 0, normal: 0, radial: -1 }), false);
    assertEquals(isZero({ prograde: 1, normal: 0, radial: 0 }), false);
});

Deno.test("nudging adds the delta and treats a missing value as 0", () => {
    assertEquals(nudge(5, 10), 15);
    assertEquals(nudge(5, -10), -5);
    assertEquals(nudge(Number.NaN, 10), 10);
});

Deno.test("nudging drops float noise", () => {
    assertEquals(nudge(1.1, -1), 0.1);
});

Deno.test("a prediction has the altitudes above the parent and the period", () => {
    const p = predict(EL, RADIUS, MU);

    assertAlmostEquals(p.periapsisAltitude, 8e6 * 0.75 - RADIUS, 1e-6);
    assertAlmostEquals(p.apoapsisAltitude, 8e6 * 1.25 - RADIUS, 1e-6);
    assertAlmostEquals(p.period, 2 * Math.PI * Math.sqrt(8e6 ** 3 / MU), 1e-6);
});

Deno.test("orbits are the same only when every element is", () => {
    assertEquals(sameElements(EL, { ...EL }), true);
    assertEquals(sameElements(EL, { ...EL, epoch: 2e6 }), false);
    assertEquals(sameElements(EL, { ...EL, m0: 3.1 }), false);
});

Deno.test("an escape message names the parent and a degenerate one the body", () => {
    assertEquals(
        failureMessage("escape", "Earth", "Moon"),
        "This burn would escape Earth. Escape orbits aren't supported.",
    );
    assertEquals(
        failureMessage("degenerate", "Earth", "Moon"),
        "This burn would leave Moon with no orbit plane.",
    );
});

Deno.test("previewing a burn gives the new orbit of a body with a parent", () => {
    const system = compile(documentOf(solarSystem), PRESETS);
    const dv = { prograde: 100, normal: 0, radial: 0 };

    const result = previewBurn(solarSystem, system, "moon", 0, dv);
    const before = system.elementsAt("moon", 0);

    assert(result.ok);
    assert(result.elements.a !== before.a);
});

Deno.test("previewing a burn throws for an unknown body or one with no orbit", () => {
    const system = compile(documentOf(solarSystem), PRESETS);
    const dv = { prograde: 100, normal: 0, radial: 0 };

    assertThrows(() => previewBurn(solarSystem, system, "nowhere", 0, dv));
    assertThrows(() => previewBurn(solarSystem, system, "sun", 0, dv));
});
