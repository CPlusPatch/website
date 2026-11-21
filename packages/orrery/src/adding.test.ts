/// <reference types="deno" />
import { G, solarSystem } from "@cpluspatch/orbit";
import { assertAlmostEquals, assertEquals } from "@std/assert";
import { newBody, slugId, subtreeIds } from "./adding.ts";

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
    assertEquals(subtreeIds(solarSystem, "earth"), ["earth", "moon", "iss"]);
    assertEquals(subtreeIds(solarSystem, "moon"), ["moon"]);
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
        "tiny",
    ]);
    assertEquals(subtreeIds(scenario, "moon"), ["moon", "tiny"]);
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
