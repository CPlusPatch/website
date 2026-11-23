/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/orbit";
import { assertEquals } from "@std/assert";
import { found, marked, treeOrder } from "./search.ts";

const names = (query: string) =>
    found(solarSystem.bodies, query).map((body) => body.name);

Deno.test("a blank query lists every body in the order given", () => {
    const all = solarSystem.bodies.map((body) => body.name);

    assertEquals(names(""), all);
    assertEquals(names("  "), all);
});

Deno.test("a query ignores case and the spaces around it", () => {
    assertEquals(names(" MARS "), ["Mars", "Mars Express", "Mars Odyssey"]);
});

Deno.test("name prefixes come before other substrings", () => {
    assertEquals(names("ar"), [
        "Ariel",
        "Earth",
        "Mars",
        "PariSat",
        "Mars Express",
        "Mars Odyssey",
        "Parker Solar Probe",
        "Solar Orbiter",
        "Charon",
    ]);
});

Deno.test("a query that matches no name finds nothing", () => {
    assertEquals(names("zzz"), []);
});

Deno.test("the match in a name is split out with its own case", () => {
    assertEquals(marked("Mars", "AR"), ["M", "ar", "s"]);
    assertEquals(marked("Mars", "ma"), ["", "Ma", "rs"]);
});

Deno.test("a name with no match, or a blank query, is left whole", () => {
    assertEquals(marked("Mars", "x"), ["Mars", "", ""]);
    assertEquals(marked("Mars", " "), ["Mars", "", ""]);
});

Deno.test("each body is followed by its children, before the next sibling", () => {
    const order = treeOrder(solarSystem.bodies).map((body) => body.name);
    const earth = order.indexOf("Earth");

    assertEquals(order.length, solarSystem.bodies.length);
    assertEquals(order.slice(earth + 1, earth + 13).sort(), [
        "Chandrayaan-2",
        "Danuri",
        "GOES-19",
        "GPS BIII-1",
        "Hubble",
        "ISS",
        "LRO",
        "Landsat 9",
        "Meridian 10",
        "Moon",
        "PariSat",
        "Tiangong",
    ]);
    assertEquals(order.indexOf("Mars"), earth + 13);
});
