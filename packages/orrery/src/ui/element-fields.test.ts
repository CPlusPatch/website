/// <reference types="deno" />
import { AU } from "@cpluspatch/orbit";
import type { Field } from "@cpluspatch/render";
import { assertAlmostEquals, assertEquals } from "@std/assert";
import {
    aScale,
    type Baseline,
    changedFields,
    dragText,
    siOf,
    specs,
    switchedA,
    type Typed,
    toDisplay,
    toSi,
} from "./element-fields.ts";

const FIELDS: Field[] = ["a", "e", "i", "raan", "argp", "m"];
const A = 2 * AU;

const base = (over: Partial<Baseline> = {}): Baseline => ({
    starts: new Map<Field, string>([
        ["a", "2.0000"],
        ["e", "0.10000"],
        ["i", "5.00"],
        ["raan", "0.00"],
        ["argp", "0.00"],
        ["m", "90.00"],
    ]),
    exact: null,
    a: A,
    unit: "AU",
    ...over,
});

const typing =
    (values: Partial<Record<Field, Typed>>) =>
    (field: Field): Typed | undefined =>
        values[field];

Deno.test("aScale in km steps by 1000 with no decimals", () => {
    assertEquals(aScale("km", 7e6), { step: 1000, decimals: 0 });
});

Deno.test("aScale in AU keeps four significant digits for a small orbit", () => {
    const { step, decimals } = aScale("AU", 0.01 * AU);

    assertAlmostEquals(step, 0.001, 1e-12);
    assertEquals(decimals, 5);
});

Deno.test("aScale in AU caps the step at 0.05 and the decimals at 4 or more", () => {
    assertEquals(aScale("AU", 30 * AU), { step: 0.05, decimals: 4 });
});

Deno.test("specs lists the six fields in order, with the unit on the semi-major axis", () => {
    const list = specs("km", 7e6);

    assertEquals(
        list.map((spec) => spec.field),
        FIELDS,
    );
    assertEquals(list[0]?.unit, "km");
    assertEquals(list[1]?.unit, "");
});

Deno.test("toSi and toDisplay convert degrees, leave eccentricity and scale distances", () => {
    assertAlmostEquals(toSi("i", 180, "km"), Math.PI, 1e-12);
    assertAlmostEquals(toDisplay("raan", Math.PI, "km"), 180, 1e-12);
    assertEquals(toSi("e", 0.3, "km"), 0.3);
    assertEquals(toDisplay("e", 0.3, "km"), 0.3);
    assertEquals(toSi("a", 7000, "km"), 7e6);
    assertEquals(toDisplay("a", 7e6, "km"), 7000);
});

Deno.test("siOf uses the exact size only while the text is the one it was kept for", () => {
    const exact = { metres: 7_123_456, text: "7123" };

    assertEquals(
        siOf("a", { text: "7123", number: 7123 }, "km", exact),
        7_123_456,
    );
    assertEquals(
        siOf("a", { text: "7200", number: 7200 }, "km", exact),
        7_200_000,
    );
    assertEquals(siOf("e", { text: "7123", number: 7123 }, "km", exact), 7123);
});

Deno.test("changedFields lists nothing while every field has its start text", () => {
    const typed = typing({
        a: { text: "2.0000", number: 2 },
        e: { text: "0.10000", number: 0.1 },
    });

    assertEquals(changedFields(FIELDS, typed, base()), []);
});

Deno.test("changedFields lists a changed field in metres or radians, in the order of the fields", () => {
    const typed = typing({
        m: { text: "10.00", number: 10 },
        i: { text: "180.00", number: 180 },
    });

    const changed = changedFields(FIELDS, typed, base());

    assertEquals(
        changed.map(([field]) => field),
        ["i", "m"],
    );
    assertAlmostEquals(changed[0]?.[1] ?? 0, Math.PI, 1e-12);
});

Deno.test("changedFields skips an exact semi-major axis that still equals the original", () => {
    const typed = typing({ a: { text: "2.0", number: 2 } });

    const same = base({ exact: { metres: A, text: "2.0" } });
    const moved = base({ exact: { metres: A + 1, text: "2.0" } });

    assertEquals(changedFields(FIELDS, typed, same), []);
    assertEquals(changedFields(FIELDS, typed, moved), [["a", A + 1]]);
});

Deno.test("changedFields reads a NaN as a change, for the check to report", () => {
    const typed = typing({ e: { text: "", number: Number.NaN } });

    const changed = changedFields(FIELDS, typed, base());

    assertEquals(changed.length, 1);
    assertEquals(Number.isNaN(changed[0]?.[1]), true);
});

Deno.test("dragText writes the displayed value at the field's decimals", () => {
    assertEquals(dragText("a", 7e6, "km", 0, 0, ""), "7000");
    assertEquals(dragText("i", Math.PI / 2, "km", 2, 0, ""), "90.00");
});

Deno.test("dragText gives the start text for a mean anomaly within 1e-9 of now, across the wrap", () => {
    assertEquals(dragText("m", 0.3 + 1e-10, "km", 2, 0.3, "start"), "start");
    assertEquals(
        dragText("m", 0.3 + 2 * Math.PI, "km", 2, 0.3, "start"),
        "start",
    );
    assertEquals(dragText("m", 0.3 + 1e-6, "km", 2, 0.3, "start"), "17.19");
    assertEquals(dragText("m", 0.4, "km", 2, 0.3, "start"), "22.92");
});

Deno.test("switchedA gives the start text for an untouched field and no exact size", () => {
    assertEquals(switchedA(true, 7e6, "km", 0, "7000"), {
        text: "7000",
        exact: null,
    });
});

Deno.test("switchedA keeps the exact size of a typed field in the new unit", () => {
    assertEquals(switchedA(false, 7_123_456, "km", 0, "7000"), {
        text: "7123",
        exact: { metres: 7_123_456, text: "7123" },
    });
});

Deno.test("switchedA leaves a field that isn't a number as it is", () => {
    assertEquals(switchedA(false, Number.NaN, "km", 0, "7000"), null);
});
