/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/catalog";
import { AU } from "@cpluspatch/orbit";
import { assertEquals, assertThrows } from "@std/assert";
import {
    canParent,
    defaultA,
    defaultKind,
    KINDS,
    kindOf,
    moveMass,
    text,
    typedMetres,
} from "./fields.ts";

const body = (id: string) => {
    const found = solarSystem.bodies.find((other) => other.id === id);
    if (!found) throw new Error(`The solar system has no ${id}.`);

    return found;
};

Deno.test("the kinds are the tags the form offers, with their labels", () => {
    const values = KINDS.map(([value]) => value);

    assertEquals(values.includes("planet"), true);
    assertEquals(values.includes("moon"), true);
    assertEquals(
        KINDS.every(([, label]) => label.length > 0),
        true,
    );
});

Deno.test("a known kind comes back and an unknown one throws", () => {
    assertEquals(kindOf("moon"), "moon");
    assertThrows(() => kindOf("star"), Error, "unknown kind");
});

Deno.test("a body can be a parent unless its tag says it can't", () => {
    assertEquals(canParent(body("sun")), true);
    assertEquals(canParent(body("earth")), true);
    assertEquals(canParent(body("moon")), false);
});

Deno.test("a new body around the root is a planet at 1 AU", () => {
    assertEquals(defaultKind(body("sun")), "planet");
    assertEquals(defaultA(body("sun")), AU);
});

Deno.test("a new body around another body is a moon at ten radii", () => {
    const earth = body("earth");

    assertEquals(defaultKind(earth), "moon");
    assertEquals(defaultA(earth), earth.mass.radius * 10);
});

Deno.test("mass moves a power of ten without float noise", () => {
    assertEquals(moveMass(1e20, 1), 1e21);
    assertEquals(moveMass(1e20, -1), 1e19);
    assertEquals(moveMass(5.97e24, 1), 5.97e25);
});

Deno.test("a number's text drops float noise", () => {
    assertEquals(text(0.1 + 0.2), "0.3");
    assertEquals(text(1.5), "1.5");
    assertEquals(text(1e21), "1e+21");
});

Deno.test("a typed semi-major axis is converted from the unit", () => {
    assertEquals(typedMetres("2", 2, "km", null), 2000);
    assertEquals(typedMetres("1", 1, "AU", null), AU);
});

Deno.test("an unchanged text keeps the exact size it was set from", () => {
    const exact = { metres: 1234567, text: "1234.57" };

    assertEquals(typedMetres("1234.57", 1234.57, "km", exact), 1234567);
    assertEquals(typedMetres("1235", 1235, "km", exact), 1235000);
});
