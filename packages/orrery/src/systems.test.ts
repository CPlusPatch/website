/// <reference types="deno" />
import { AU, type Body, eridani, kerbol, solarSystem } from "@cpluspatch/orbit";
import {
    assert,
    assertAlmostEquals,
    assertEquals,
    assertThrows,
} from "@std/assert";
import { facts, type Group, leftPane, path, rail, system } from "./systems.ts";

const solar = solarSystem.bodies;

const labels = (groups: Group[]) => groups.map((group) => group.label);

const rows = (group: Group | undefined) =>
    (group?.rows ?? []).map(({ body, nested }) =>
        nested ? `> ${body.name}` : body.name,
    );

/** A body on an orbit of semi-major axis `a` and eccentricity `e` around `parent`. */
const made = (id: string, parent: string | null, a: number, e = 0): Body =>
    parent === null
        ? {
              id,
              name: id,
              kind: "star",
              parent,
              mu: 1e10,
              radius: 1,
              elements: null,
          }
        : {
              id,
              name: id,
              kind: "planet",
              parent,
              mu: 1e10,
              radius: 1,
              elements: { a, e, i: 0, raan: 0, argp: 0, m0: 0, epoch: 0 },
          };

Deno.test("the left pane groups the root's children and drops empty groups", () => {
    const { root, groups } = leftPane(solar);

    assertEquals(root.id, "sun");
    assertEquals(labels(groups), [
        "Planets",
        "Dwarf planets",
        "Small bodies",
        "Spacecraft",
    ]);
    assertEquals(rows(groups[0])[2], "Earth");
    assertEquals(rows(groups[2]), ["Vesta", "Halley"]);
    assert(groups.every((group) => group.rows.every((row) => !row.nested)));
});

Deno.test("the left pane of a multiple star system has a Stars group", () => {
    const { root, groups } = leftPane(eridani.bodies);

    assertEquals(root.id, "40-eridani-a");
    assertEquals(labels(groups), ["Stars", "Planets"]);
    assertEquals(rows(groups[0]), ["40 Eridani B"]);
});

Deno.test("the left pane throws when no body is the root", () => {
    assertThrows(() => leftPane([made("a", "b", 1)]), Error, "no root");
});

Deno.test("a system lists the moons with their craft nested, then its own craft", () => {
    const groups = system(solar, "earth");

    assertEquals(labels(groups), ["Moons", "Spacecraft"]);
    assertEquals(rows(groups[0]).slice(0, 2), ["Moon", "> LRO"]);
    assert(rows(groups[0]).includes("> Danuri"));
    assertEquals(rows(groups[1]).includes("ISS"), true);
    assert(groups[1].rows.every((row) => !row.nested));
});

Deno.test("the root's system groups its children, with their moons nested", () => {
    const groups = system(solar, "sun");

    const planets = rows(groups[0]);
    const earth = planets.indexOf("Earth");

    assertEquals(labels(groups)[0], "Planets");
    assertEquals(planets.slice(earth, earth + 3), ["Earth", "> Moon", "> ISS"]);
});

Deno.test("a body with no children has an empty system", () => {
    assertEquals(system(solar, "halley"), []);
});

Deno.test("a system in a fiction scenario nests children too", () => {
    const groups = system(eridani.bodies, "40-eridani-b");

    assertEquals(labels(groups), ["Stars"]);
    assertEquals(rows(groups[0]), ["40 Eridani C"]);
    assertEquals(rows(system(kerbol.bodies, "kerbin")[0]), ["Mun", "Minmus"]);
});

Deno.test("a system of an unknown body throws", () => {
    assertThrows(
        () => system(solar, "nope"),
        Error,
        'There is no body "nope".',
    );
});

Deno.test("a path lists the ancestors between the root and the body", () => {
    assertEquals(path(solar, "lro"), "Earth › Moon");
    assertEquals(path(solar, "moon"), "Earth");
    assertEquals(path(solar, "earth"), "");
    assertEquals(path(solar, "sun"), "");
    assertEquals(path(eridani.bodies, "40-eridani-c"), "40 Eridani B");
    assertThrows(() => path(solar, "nope"), Error, 'There is no body "nope".');
});

Deno.test("a rail puts the nearest child at 0 and the farthest at 1", () => {
    const result = rail(solar, "sun");
    assert(result);

    const at = (id: string) =>
        result.marks.find((mark) => mark.body.id === id)?.at;

    assertEquals(at("mercury"), 0);
    assertEquals(at("eris"), 1);
    assert((at("earth") ?? 0) > (at("venus") ?? 1));
    assertAlmostEquals(result.lo, 57909226541.52439, 1);
});

Deno.test("a rail has a tick at each power of ten within its range", () => {
    const result = rail(solar, "earth");
    assert(result);

    for (const tick of result.ticks) {
        assertEquals(Math.log10(tick.distance) % 1, 0);
        assert(
            tick.distance >= result.lo * 0.9999 &&
                tick.distance <= result.hi * 1.0001,
        );
        assert(tick.at >= 0 && tick.at <= 1);
    }
    assertEquals(
        result.ticks.map((tick) => tick.distance),
        [1e7, 1e8],
    );
});

Deno.test("a rail ticks a power of ten that sits on an end", () => {
    const result = rail(
        [made("s", null, 0), made("a", "s", 1e9), made("b", "s", 1e11)],
        "s",
    );

    assertEquals(
        result?.ticks.map((tick) => tick.distance),
        [1e9, 1e10, 1e11],
    );
    assertEquals(result?.ticks[0].at, 0);
    assertEquals(result?.ticks[2].at, 1);
});

Deno.test("a rail with one distance puts every child in the middle with no ticks", () => {
    const result = rail(
        [made("s", null, 0), made("a", "s", 5e9), made("b", "s", 5e9)],
        "s",
    );

    assertEquals(
        result?.marks.map((mark) => mark.at),
        [0.5, 0.5],
    );
    assertEquals(result?.ticks, []);
});

Deno.test("a rail uses the size of a hyperbolic orbit", () => {
    const result = rail(
        [made("s", null, 0), made("a", "s", -2e9, 1.5), made("b", "s", 2e10)],
        "s",
    );

    assertEquals(result?.lo, 2e9);
    assertEquals(result?.marks[0].at, 0);
});

Deno.test("a rail in AU ticks at powers of ten of an AU", () => {
    const result = rail(solar, "sun", AU);

    assertEquals(
        result?.ticks.map((tick) => tick.distance / AU),
        [1, 10],
    );
});

Deno.test("a rail is null when the body has no children", () => {
    assertEquals(rail(solar, "halley"), null);
});

Deno.test("the facts of Earth are a year and its radius", () => {
    const earth = facts(solar, "earth");

    assertAlmostEquals(earth.period ?? 0, 365.25 * 86400, 365.25 * 86.4);
    assertEquals(
        earth.radius,
        solar.find((body) => body.id === "earth")?.radius,
    );
});

Deno.test("the root has a radius and no period", () => {
    const sun = facts(solar, "sun");

    assertEquals(sun.period, null);
    assert((sun.radius ?? 0) > 6e8);
});

Deno.test("a spacecraft has a period and no radius", () => {
    const iss = facts(solar, "iss");

    assert((iss.period ?? 0) > 5000 && (iss.period ?? 0) < 6000);
    assertEquals(iss.radius, null);
});

Deno.test("a hyperbolic body has no period", () => {
    const bodies = [made("s", null, 0), made("a", "s", -2e9, 1.5)];

    assertEquals(facts(bodies, "a"), { period: null, radius: 1 });
});

Deno.test("the facts of an unknown body throw", () => {
    assertThrows(() => facts(solar, "nope"), Error, 'There is no body "nope".');
});
