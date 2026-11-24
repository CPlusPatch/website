/// <reference types="deno" />
import { G, solarSystem } from "@cpluspatch/orbit";
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import {
    type AddInput,
    addErrors,
    newBody,
    removalNote,
    slugId,
    subtreeIds,
} from "./adding.ts";
import { aMin, fieldError } from "./editing.ts";

const none = new Set<string>();

Deno.test("a slug is lowercase words joined by hyphens", () => {
    assertEquals(slugId("Hello World", none), "hello-world");
    assertEquals(slugId("  --Apollo 11!--  ", none), "apollo-11");
});

Deno.test("a slug drops accents and punctuation", () => {
    assertEquals(slugId("Café Éclair", none), "cafe-eclair");
    assertEquals(slugId("Ceres (1)", none), "ceres-1");
});

Deno.test("a name with nothing to keep becomes body", () => {
    assertEquals(slugId("", none), "body");
    assertEquals(slugId("!!! ???", none), "body");
});

Deno.test("a taken slug gets the next free number", () => {
    assertEquals(slugId("Moon", new Set(["moon"])), "moon-2");
    assertEquals(slugId("Moon", new Set(["moon", "moon-2"])), "moon-3");
});

Deno.test("the subtree of a planet holds its moons", () => {
    assertEquals(subtreeIds(solarSystem, "earth"), [
        "earth",
        "moon",
        "iss",
        "hubble",
        "tiangong",
        "landsat-9",
        "gps-biii-1",
        "goes-19",
        "meridian-10",
        "parisat",
        "lro",
        "chandrayaan-2",
        "danuri",
    ]);
    assertEquals(subtreeIds(solarSystem, "moon"), [
        "moon",
        "lro",
        "chandrayaan-2",
        "danuri",
    ]);
});

Deno.test("the subtree of a moon of a moon is reached through the moon", () => {
    const [sun] = solarSystem.bodies;
    const body = (id: string, parent: string) => ({
        ...newBody(
            {
                id,
                name: id,
                kind: "moon",
                parent: sun,
                radiusKm: 1,
                massKg: 0,
                aKm: 2,
                e: 0,
                iDeg: 0,
            },
            0,
        ),
        parent,
    });
    const scenario = {
        ...solarSystem,
        bodies: [...solarSystem.bodies, body("tiny", "moon")],
    };

    assertEquals(subtreeIds(scenario, "earth"), [
        "earth",
        "moon",
        "iss",
        "hubble",
        "tiangong",
        "landsat-9",
        "gps-biii-1",
        "goes-19",
        "meridian-10",
        "parisat",
        "lro",
        "chandrayaan-2",
        "danuri",
        "tiny",
    ]);
    assertEquals(subtreeIds(scenario, "moon"), [
        "moon",
        "lro",
        "chandrayaan-2",
        "danuri",
        "tiny",
    ]);
});

Deno.test("a new body converts km, degrees and kg to SI", () => {
    const earth = solarSystem.bodies.find((body) => body.id === "earth");
    if (!earth) throw new Error("no earth");

    const body = newBody(
        {
            id: "rock",
            name: "Rock",
            kind: "dwarf",
            parent: earth,
            radiusKm: 100,
            massKg: 1e20,
            aKm: 20000,
            e: 0.25,
            iDeg: 90,
        },
        42,
    );

    assertEquals(body.id, "rock");
    assertEquals(body.name, "Rock");
    assertEquals(body.kind, "dwarf");
    assertEquals(body.parent, "earth");
    assertEquals(body.radius, 100_000);
    assertAlmostEquals(body.mu, G * 1e20, 1e-12);
    assertEquals(body.elements, {
        a: 20_000_000,
        e: 0.25,
        i: Math.PI / 2,
        raan: 0,
        argp: 0,
        m0: 0,
        epoch: 42,
    });
});

Deno.test("a body with nothing around it takes nothing with it", () => {
    assertEquals(removalNote(solarSystem, "iss"), "");
});

Deno.test("a planet with a moon and a craft takes both bodies", () => {
    assertEquals(
        removalNote(solarSystem, "earth"),
        "Its 12 bodies go with it.",
    );
});

Deno.test("one body below goes by name and several are counted", () => {
    const only = (...ids: string[]) => ({
        ...solarSystem,
        bodies: solarSystem.bodies.filter((body) => ids.includes(body.id)),
    });

    assertEquals(
        removalNote(only("sun", "earth", "moon"), "earth"),
        "Moon goes with it.",
    );
    assertEquals(
        removalNote(only("sun", "earth", "iss"), "earth"),
        "ISS goes with it.",
    );

    const [moon] = solarSystem.bodies.filter((body) => body.id === "moon");
    assert(moon);
    const two = only("sun", "earth", "moon");
    two.bodies.push({ ...moon, id: "moon-2", name: "Moon 2" });
    assertEquals(removalNote(two, "earth"), "Its 2 moons go with it.");
});

const earth = solarSystem.bodies.find((body) => body.id === "earth");
if (!earth) throw new Error("no earth");

const valid: AddInput = {
    name: "Rock",
    parent: earth,
    radiusKm: 500,
    massKg: 1e20,
    aMetres: 60_000_000,
    e: 0,
    iDeg: 0,
    unit: "km",
};

const errorsOf = (change: Partial<AddInput>) =>
    addErrors({ ...valid, ...change }, solarSystem);

Deno.test("a valid body has no errors", () => {
    assertEquals(errorsOf({}), {});
});

Deno.test("a blank name asks for one", () => {
    assertEquals(errorsOf({ name: "  " }).name, "Enter a name.");
});

Deno.test("a name taken by another body is refused whatever its case", () => {
    assertEquals(
        errorsOf({ name: " moon " }).name,
        "A body named Moon already exists.",
    );
});

Deno.test("a size or mass that isn't a number asks for one", () => {
    const errors = errorsOf({ radiusKm: Number.NaN, massKg: Number.NaN });

    assertEquals(errors.radius, "Enter a number.");
    assertEquals(errors.mass, "Enter a number.");
});

Deno.test("a radius or mass of 0 or less is refused", () => {
    const errors = errorsOf({ radiusKm: 0, massKg: -1 });

    assertEquals(errors.radius, "Radius must be above 0 km.");
    assertEquals(errors.mass, "Mass must be above 0 kg.");
});

Deno.test("the orbit's limits read as they do in the edit form", () => {
    const errors = errorsOf({
        aMetres: 1000,
        e: 1,
        iDeg: 181,
        unit: "km",
    });

    assertEquals(
        errors.a,
        fieldError("a", 1000, { aMin: aMin(earth.radius), unit: "km" }),
    );
    assertEquals(errors.e, "Must be at least 0 and at most 0.99.");
    assertEquals(errors.i, "Must be between 0° and 180°.");
});

Deno.test("the limits of the semi-major axis follow the unit", () => {
    const km = errorsOf({ aMetres: 1000, unit: "km" }).a;
    const au = errorsOf({ aMetres: 1000, unit: "AU" }).a;

    assert(km?.endsWith(" km."));
    assert(au?.endsWith(" AU."));
});

Deno.test("an orbit that isn't a number asks for one", () => {
    const errors = errorsOf({
        aMetres: Number.NaN,
        e: Number.NaN,
        iDeg: Number.NaN,
    });

    assertEquals(errors.a, "Enter a number.");
    assertEquals(errors.e, "Enter a number.");
    assertEquals(errors.i, "Enter a number.");
});

Deno.test("a periapsis inside the parent is blamed on the eccentricity", () => {
    const errors = errorsOf({ aMetres: earth.radius * 2, e: 0.6 });

    assertEquals(errors.e, "Periapsis would be inside Earth.");
    assertEquals(errors.a, undefined);
});

Deno.test("the periapsis is only checked when the axis and eccentricity are valid", () => {
    const errors = errorsOf({ aMetres: earth.radius * 2, e: 2 });

    assertEquals(errors.e, "Must be at least 0 and at most 0.99.");
});
