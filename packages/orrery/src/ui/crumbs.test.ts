/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/orbit";
import { assertEquals } from "@std/assert";
import { focusPath } from "./crumbs.ts";

const ids = (id: string) =>
    focusPath(solarSystem.bodies, id).map((body) => body.id);

Deno.test("the path to a moon runs from the root through its planet", () => {
    assertEquals(ids("moon"), ["sun", "earth", "moon"]);
});

Deno.test("the path to the root is the root alone", () => {
    assertEquals(ids("sun"), ["sun"]);
});

Deno.test("the path to an unknown id is empty", () => {
    assertEquals(ids("nowhere"), []);
});
