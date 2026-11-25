/// <reference types="deno" />
import { AU, type Elements } from "@cpluspatch/orbit";
import { assertAlmostEquals, assertEquals } from "@std/assert";
import { A_MAX, dragApsis, tiltInclination } from "./drag.ts";

const EL: Elements = {
    a: 7e6,
    e: 0.1,
    i: 0.9,
    raan: 1,
    argp: 2,
    m0: 3,
    epoch: 1e6,
};

// A 1 AU orbit with an apsis 10% either side of it.
const SHAPE: Elements = { ...EL, a: AU, e: 0.1 };
const PE = 0.9 * AU;
const AP = 1.1 * AU;
const FLOOR = 6e6;

Deno.test("dragging the periapsis moves it and keeps the apoapsis", () => {
    const { a, e } = dragApsis("pe", SHAPE, -0.2 * AU, FLOOR);

    assertAlmostEquals(a * (1 - e), 0.7 * AU, 1);
    assertAlmostEquals(a * (1 + e), AP, 1);
});

Deno.test("dragging the apoapsis moves it and keeps the periapsis", () => {
    const { a, e } = dragApsis("ap", SHAPE, -0.5 * AU, FLOOR);

    assertAlmostEquals(a * (1 - e), PE, 1);
    assertAlmostEquals(a * (1 + e), 1.6 * AU, 1);
});

Deno.test("the periapsis dragged past the apoapsis swaps them", () => {
    const { a, e, swapped } = dragApsis("pe", SHAPE, 0.5 * AU, FLOOR);

    // The dragged apsis is at 1.4 AU now and the other stays at 1.1 AU.
    assertAlmostEquals(a * (1 - e), AP, 1);
    assertAlmostEquals(a * (1 + e), 1.4 * AU, 1);
    assertEquals(swapped, true);
});

Deno.test("a periapsis drag short of the apoapsis doesn't swap", () => {
    assertEquals(dragApsis("pe", SHAPE, 0.1 * AU, FLOOR).swapped, false);
    assertEquals(dragApsis("pe", SHAPE, 0, FLOOR).swapped, false);
});

Deno.test("the periapsis stops at the minimum", () => {
    const { a, e } = dragApsis("pe", SHAPE, -5 * AU, 0.5 * AU);

    assertAlmostEquals(a * (1 - e), 0.5 * AU, 1);
});

Deno.test("the periapsis stops at a 199th of the apoapsis, which keeps e to 0.99", () => {
    const { a, e } = dragApsis("pe", SHAPE, -5 * AU, FLOOR);

    assertAlmostEquals(a * (1 - e), AP / 199, 1);
    assertAlmostEquals(e, 0.99);
});

Deno.test("the apoapsis dragged under the periapsis swaps them", () => {
    const { a, e, swapped } = dragApsis("ap", SHAPE, 0.5 * AU, FLOOR);

    assertAlmostEquals(a * (1 - e), 0.6 * AU, 1);
    assertAlmostEquals(a * (1 + e), PE, 1);
    assertEquals(swapped, true);
});

Deno.test("an apoapsis drag above the periapsis doesn't swap", () => {
    assertEquals(dragApsis("ap", SHAPE, 0.1 * AU, FLOOR).swapped, false);
    assertEquals(dragApsis("ap", SHAPE, 0, FLOOR).swapped, false);
});

Deno.test("a swapped periapsis stops at 199 times the apoapsis", () => {
    const small: Elements = { ...EL, a: 0.1 * AU, e: 0.1 };
    const { a, e, swapped } = dragApsis("pe", small, 500 * AU, FLOOR);

    assertAlmostEquals(a * (1 - e), 0.11 * AU, 1e3);
    assertAlmostEquals(a * (1 + e), 199 * 0.11 * AU, 1e3);
    assertAlmostEquals(e, 0.99);
    assertEquals(swapped, true);
});

Deno.test("a swapped apoapsis stops at the minimum periapsis and at a 199th of the periapsis", () => {
    const floored = dragApsis("ap", SHAPE, 5 * AU, 0.5 * AU);
    assertAlmostEquals(floored.a * (1 - floored.e), 0.5 * AU, 1);
    assertEquals(floored.swapped, true);

    const ratio = dragApsis("ap", SHAPE, 5 * AU, FLOOR);
    assertAlmostEquals(ratio.a * (1 - ratio.e), PE / 199, 1);
    assertAlmostEquals(ratio.e, 0.99);
});

Deno.test("the apoapsis stops at 199 times the periapsis", () => {
    const { a, e } = dragApsis("ap", SHAPE, -500 * AU, FLOOR);

    assertAlmostEquals(a * (1 + e), 199 * PE, 1e3);
    assertAlmostEquals(e, 0.99);
});

Deno.test("an apsis stops where the semi-major axis reaches the most the form allows", () => {
    const wide: Elements = { ...EL, a: 90 * AU, e: 0.2 };

    assertAlmostEquals(dragApsis("ap", wide, -50 * AU, FLOOR).a, A_MAX, 1e3);
    assertAlmostEquals(dragApsis("pe", wide, 50 * AU, FLOOR).a, A_MAX, 1e3);
});

Deno.test("a swapped apsis stops where the semi-major axis reaches the most the form allows", () => {
    const wide: Elements = { ...EL, a: 60 * AU, e: 0.2 };
    const pe = dragApsis("pe", wide, 100 * AU, FLOOR);
    const ap = dragApsis("ap", wide, -100 * AU, FLOOR);

    assertAlmostEquals(pe.a, A_MAX, 1e3);
    assertEquals(pe.swapped, true);
    assertAlmostEquals(ap.a, A_MAX, 1e3);
    assertEquals(ap.swapped, false);
});

Deno.test("dragging Inc up tilts the orbit a quarter degree a px, between 0° and 180°", () => {
    assertAlmostEquals(tiltInclination(1, -4), 1 + Math.PI / 180);
    assertAlmostEquals(tiltInclination(1, 4), 1 - Math.PI / 180);
    assertEquals(tiltInclination(0.1, 1000), 0);
    assertEquals(tiltInclination(3, -1000), Math.PI);
});
