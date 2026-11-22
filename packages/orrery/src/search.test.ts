/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/orbit";
import { assertEquals } from "@std/assert";
import { found, marked } from "./search.ts";

const names = (query: string) =>
    found(solarSystem.bodies, query).map((body) => body.name);

Deno.test("a blank query lists every body in the order given", () => {
    const all = solarSystem.bodies.map((body) => body.name);

    assertEquals(names(""), all);
    assertEquals(names("  "), all);
});

Deno.test("a query ignores case and the spaces around it", () => {
    assertEquals(names(" MARS "), ["Mars"]);
});

Deno.test("name prefixes come before other substrings", () => {
    assertEquals(names("e"), [
        "Earth",
        "Mercury",
        "Venus",
        "Jupiter",
        "Neptune",
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
