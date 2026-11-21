/// <reference types="deno" />
import type { Elements } from "@cpluspatch/orbit";
import { AU, meanAnomalyAt } from "@cpluspatch/orbit";
import { assertAlmostEquals, assertEquals } from "@std/assert";
import {
    A_MAX,
    aMin,
    aToSlider,
    aUnit,
    editElements,
    fieldValue,
    fromMetres,
    passesThroughParent,
    SLIDER_MAX,
    sliderToA,
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

Deno.test("the slider maps the ends of the range to the ends of the log scale", () => {
    const min = aMin(6.371e6);

    assertEquals(aToSlider(min, min, A_MAX), 0);
    assertAlmostEquals(aToSlider(A_MAX, min, A_MAX), SLIDER_MAX, 1e-9);
    assertAlmostEquals(sliderToA(0, min, A_MAX), min, 1e-3);
    assertAlmostEquals(sliderToA(SLIDER_MAX, min, A_MAX) / A_MAX, 1, 1e-12);
});

Deno.test("the slider and the semi-major axis round-trip", () => {
    const min = aMin(6.371e6);

    for (const a of [min, 7e6, 3.844e8, AU, 30 * AU]) {
        assertAlmostEquals(
            sliderToA(aToSlider(a, min, A_MAX), min, A_MAX) / a,
            1,
            1e-12,
        );
    }
});

Deno.test("values outside the range clamp to its ends", () => {
    const min = aMin(6.371e6);

    assertEquals(aToSlider(min / 2, min, A_MAX), 0);
    assertEquals(aToSlider(A_MAX * 2, min, A_MAX), SLIDER_MAX);
    assertEquals(sliderToA(-5, min, A_MAX), min);
    assertAlmostEquals(sliderToA(SLIDER_MAX * 2, min, A_MAX) / A_MAX, 1, 1e-12);
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
