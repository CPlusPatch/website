/// <reference types="deno" />
import { type Body, solarSystem } from "@cpluspatch/orbit";
import { assert, assertEquals } from "@std/assert";
import { BODY_COLORS, colorOf } from "./theme.ts";

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

Deno.test("every body of the solar system has a colour of its own", () => {
    for (const { id } of solarSystem.bodies) assert(id in BODY_COLORS, id);
});
