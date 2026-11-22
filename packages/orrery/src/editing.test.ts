/// <reference types="deno" />
import type { Elements } from "@cpluspatch/orbit";
import { AU, meanAnomalyAt, stateAt } from "@cpluspatch/orbit";
import { assertAlmostEquals, assertEquals } from "@std/assert";
import {
    A_MAX,
    aMin,
    aUnit,
    DEGREES,
    draftElements,
    dragApsis,
    editElements,
    fieldError,
    fieldValue,
    fromMetres,
    passesThroughParent,
    toMetres,
} from "./editing.ts";

const MU = 3.986004418e14;
const T = 5e6;
const EL: Elements = {
    a: 7e6,
    e: 0.1,
    i: 0.9,
    raan: 1,
    argp: 2,
    m0: 3,
    epoch: 1e6,
};

Deno.test("editing a, e, i, the node or the periapsis keeps the mean anomaly at that time", () => {
    const before = meanAnomalyAt(EL, MU, T);

    for (const [field, value] of [
        ["a", 9e6],
        ["e", 0.5],
        ["i", 0.2],
        ["raan", 4],
        ["argp", 5],
    ] as const) {
        const edited = editElements(EL, MU, T, field, value);

        assertEquals(edited[field], value);
        assertEquals(edited.epoch, T);
        assertAlmostEquals(meanAnomalyAt(edited, MU, T), before, 1e-9);
    }
});

Deno.test("editing the mean anomaly sets it at the new epoch", () => {
    const edited = editElements(EL, MU, T, "m", 1.5);

    assertEquals(edited.epoch, T);
    assertEquals(meanAnomalyAt(edited, MU, T), 1.5);
    assertEquals(edited.a, EL.a);
});

Deno.test("the node, the periapsis and the mean anomaly are wrapped into a turn", () => {
    for (const [field, key] of [
        ["m", "m0"],
        ["raan", "raan"],
        ["argp", "argp"],
    ] as const) {
        const edited = editElements(EL, MU, T, field, 2 * Math.PI + 0.5);

        assertAlmostEquals(edited[key], 0.5, 1e-12);
    }
});

Deno.test("fieldValue reads the mean anomaly at the time and the other elements as stored", () => {
    assertEquals(fieldValue(EL, MU, T, "m"), meanAnomalyAt(EL, MU, T));
    assertEquals(fieldValue(EL, MU, T, "argp"), EL.argp);
});

Deno.test("a is shown in km under 0.1 AU and in AU from there", () => {
    assertEquals(aUnit(0.099 * AU), "km");
    assertEquals(aUnit(0.1 * AU), "AU");
    assertEquals(fromMetres(7e6, "km"), 7000);
    assertEquals(fromMetres(2 * AU, "AU"), 2);
    assertEquals(toMetres(7000, "km"), 7e6);
    assertEquals(toMetres(2, "AU"), 2 * AU);
});

Deno.test("an orbit passes through its parent when periapsis is below the radius", () => {
    const radius = 6.371e6;

    assertEquals(passesThroughParent({ ...EL, a: 7e6, e: 0.1 }, radius), true);
    assertEquals(
        passesThroughParent({ ...EL, a: 7e6, e: 0.05 }, radius),
        false,
    );
    assertEquals(
        passesThroughParent({ ...EL, a: radius, e: 0 }, radius),
        false,
    );
});

Deno.test("a draft with no changes keeps the orbit", () => {
    const draft = draftElements(EL, MU, T, {});

    assertEquals(draft.a, EL.a);
    assertEquals(draft.e, EL.e);
    assertEquals(draft.i, EL.i);
    const now = stateAt(draft, MU, T).r;
    const before = stateAt(EL, MU, T).r;
    assertAlmostEquals(now.x, before.x, 1e-3);
    assertAlmostEquals(now.y, before.y, 1e-3);
    assertAlmostEquals(now.z, before.z, 1e-3);
});

Deno.test("a draft that changes only a keeps the mean anomaly at that time", () => {
    const draft = draftElements(EL, MU, T, { a: 9e6 });

    assertEquals(draft.a, 9e6);
    assertAlmostEquals(
        meanAnomalyAt(draft, MU, T),
        meanAnomalyAt(EL, MU, T),
        1e-9,
    );
});

Deno.test("a draft applies each change it holds and no other", () => {
    const draft = draftElements(EL, MU, T, { e: 0.3, raan: 4, m: 1.5 });

    assertEquals(draft.e, 0.3);
    assertEquals(draft.raan, 4);
    assertEquals(meanAnomalyAt(draft, MU, T), 1.5);
    assertEquals(draft.a, EL.a);
    assertEquals(draft.i, EL.i);
    assertEquals(draft.argp, EL.argp);
});

Deno.test("a value that isn't a number is an error for every field", () => {
    for (const field of ["a", "e", "i", "raan", "argp", "m"] as const) {
        assertEquals(fieldError(field, Number.NaN, 7e6), "Enter a number.");
        assertEquals(fieldError(field, Infinity, 7e6), "Enter a number.");
    }
});

Deno.test("a must be between its limits, which the message gives in the unit", () => {
    const min = aMin(6.371e6);

    assertEquals(fieldError("a", min, min), null);
    assertEquals(fieldError("a", A_MAX, min), null);
    assertEquals(
        fieldError("a", min - 1, min, "km"),
        "Must be between 6,435 and 14,959,787,070 km.",
    );
    assertEquals(
        fieldError("a", A_MAX * 2, 0.5 * AU, "AU"),
        "Must be between 0.5 and 100 AU.",
    );
});

Deno.test("e must be from 0 to 0.99", () => {
    const message = "Must be at least 0 and at most 0.99.";

    assertEquals(fieldError("e", 0, 7e6), null);
    assertEquals(fieldError("e", 0.99, 7e6), null);
    assertEquals(fieldError("e", -0.01, 7e6), message);
    assertEquals(fieldError("e", 0.991, 7e6), message);
});

Deno.test("i must be from 0 to 180 degrees, given in radians", () => {
    const message = "Must be between 0° and 180°.";

    assertEquals(fieldError("i", 0, 7e6), null);
    assertEquals(fieldError("i", 180 / DEGREES, 7e6), null);
    assertEquals(fieldError("i", -0.1, 7e6), message);
    assertEquals(fieldError("i", 180.5 / DEGREES, 7e6), message);
});

Deno.test("the node, the periapsis and the mean anomaly take any number", () => {
    for (const field of ["raan", "argp", "m"] as const) {
        assertEquals(fieldError(field, -50, 7e6), null);
        assertEquals(fieldError(field, 50, 7e6), null);
    }
});

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

Deno.test("the periapsis stops at the apoapsis", () => {
    const { a, e } = dragApsis("pe", SHAPE, 5 * AU, FLOOR);

    assertAlmostEquals(a, AP);
    assertEquals(e, 0);
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

Deno.test("the apoapsis stops at the periapsis", () => {
    const { a, e } = dragApsis("ap", SHAPE, 5 * AU, FLOOR);

    assertAlmostEquals(a, PE);
    assertEquals(e, 0);
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
