/// <reference types="deno" />
import { type Body, solarSystem } from "@cpluspatch/orbit";
import { assert, assertEquals } from "@std/assert";
import { BODY_COLORS, colorOf, ORBIT_CLASS_COLORS } from "./theme.ts";

const body = (id: string, kind: Body["kind"], color?: string): Body => ({
    id,
    name: id,
    kind,
    parent: null,
    mu: 1,
    radius: 1,
    elements: null,
    ...(color === undefined ? {} : { color }),
});

Deno.test("an explicit colour wins over the id and the kind", () => {
    assertEquals(colorOf(body("earth", "planet", "gold")), "gold");
});

Deno.test("a known id wins over the kind", () => {
    assertEquals(colorOf(body("earth", "planet")), BODY_COLORS.earth);
});

Deno.test("an unknown id takes its kind's colour", () => {
    assertEquals(colorOf(body("comet", "dwarf")), "var(--orrery-muted)");
    assertEquals(colorOf(body("comet", "star")), "var(--orrery-signal)");
    assertEquals(colorOf(body("rock", "asteroid")), "var(--orrery-dim)");
    assertEquals(colorOf(body("rock", "comet")), "var(--orrery-dim)");
});

Deno.test("the Sun and every planet have a colour of their own", () => {
    const named = solarSystem.bodies.filter(
        ({ kind }) => kind === "star" || kind === "planet",
    );

    for (const { id } of named) assert(id in BODY_COLORS, id);
});

const satellite = (parent: string, color?: string): Body => ({
    ...body("sat", "spacecraft", color),
    parent,
    // 7,000 km and circular: low Earth orbit.
    elements: { a: 7e6, e: 0, i: 0, raan: 0, argp: 0, m0: 0, epoch: 0 },
});

Deno.test("an Earth spacecraft takes its orbit class's colour", () => {
    assertEquals(colorOf(satellite("earth")), ORBIT_CLASS_COLORS.leo);
});

Deno.test("a spacecraft around another body keeps its kind's colour", () => {
    assertEquals(colorOf(satellite("mars")), "var(--orrery-text)");
});

Deno.test("an Earth spacecraft's own colour wins over its orbit class", () => {
    assertEquals(colorOf(satellite("earth", "gold")), "gold");
});
