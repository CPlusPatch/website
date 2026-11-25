/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/catalog";
import type { Body, Model } from "@cpluspatch/sim";
import { assert, assertEquals } from "@std/assert";
import { BODY_COLORS, colorOf, ORBIT_CLASS_COLORS } from "./theme.ts";

const body = (
    id: string,
    tag: string,
    options: { color?: string; model?: Model } = {},
): Body => ({
    id,
    name: id,
    tags: [tag],
    parent: null,
    mu: 1,
    radius: 1,
    elements: null,
    ...options,
});

Deno.test("an explicit colour wins over the model and the kind", () => {
    const earth = body("earth", "planet", { color: "gold", model: "earth" });

    assertEquals(colorOf(earth, undefined), "gold");
});

Deno.test("a known model wins over the kind", () => {
    const earth = body("earth", "planet", { model: "earth" });

    assertEquals(colorOf(earth, undefined), BODY_COLORS.earth);
});

Deno.test("a body without a model takes its kind's colour, whatever its id", () => {
    assertEquals(
        colorOf(body("earth", "planet"), undefined),
        "var(--orrery-text)",
    );
    assertEquals(
        colorOf(body("comet", "dwarf"), undefined),
        "var(--orrery-muted)",
    );
    assertEquals(
        colorOf(body("comet", "star"), undefined),
        "var(--orrery-signal)",
    );
    assertEquals(
        colorOf(body("rock", "asteroid"), undefined),
        "var(--orrery-dim)",
    );
    assertEquals(
        colorOf(body("rock", "comet"), undefined),
        "var(--orrery-dim)",
    );
});

Deno.test("the Sun and every planet have a colour of their own", () => {
    const named = solarSystem.bodies.filter(
        ({ tags }) => tags.includes("star") || tags.includes("planet"),
    );

    for (const { id, model } of named) {
        assert(model !== undefined && model in BODY_COLORS, id);
    }
});

const satellite = (color?: string): Body => ({
    ...body("sat", "spacecraft", color === undefined ? {} : { color }),
    parent: "host",
    // 7,000 km and circular: low Earth orbit.
    elements: { a: 7e6, e: 0, i: 0, raan: 0, argp: 0, m0: 0, epoch: 0 },
});

Deno.test("a spacecraft around a body with model earth takes its orbit class's colour", () => {
    const host = body("home", "planet", { model: "earth" });

    assertEquals(colorOf(satellite(), host), ORBIT_CLASS_COLORS.leo);
});

Deno.test("a spacecraft around a body named earth without the model keeps its kind's colour", () => {
    const host = body("earth", "planet");

    assertEquals(colorOf(satellite(), host), "var(--orrery-text)");
});

Deno.test("a spacecraft around another body keeps its kind's colour", () => {
    const host = body("mars", "planet", { model: "mars" });

    assertEquals(colorOf(satellite(), host), "var(--orrery-text)");
});

Deno.test("a spacecraft's own colour wins over its orbit class", () => {
    const host = body("home", "planet", { model: "earth" });

    assertEquals(colorOf(satellite("gold"), host), "gold");
});
