/// <reference types="deno" />

import { satellites, solarSystem } from "@cpluspatch/catalog";
import { type Elements, km } from "@cpluspatch/orbit";
import { assertEquals } from "@std/assert";
import { type OrbitClass, orbitClass } from "./orbit-class.ts";

const earth = solarSystem.bodies.find((body) => body.id === "earth");
const bodies = satellites(earth?.mu ?? 0);

Deno.test("the catalogue satellites fall in their known bands", () => {
    const expected: Record<string, OrbitClass> = {
        iss: "leo",
        hubble: "leo",
        tiangong: "leo",
        "landsat-9": "leo",
        "gps-biii-1": "meo",
        "goes-19": "geo",
        "meridian-10": "heo",
        parisat: "leo",
    };

    assertEquals(bodies.length, Object.keys(expected).length);

    for (const body of bodies) {
        assertEquals(
            body.elements && orbitClass(body.elements),
            expected[body.id],
            body.id,
        );
    }
});

const orbit = (a: number, e: number): Elements => ({
    a,
    e,
    i: 0,
    raan: 0,
    argp: 0,
    m0: 0,
    epoch: 0,
});

Deno.test("an apoapsis altitude of 2,000 km is the top of LEO", () => {
    const radius = 6_378_137 + 2_000_000;

    assertEquals(orbitClass(orbit(radius - 1, 0)), "leo");
    assertEquals(orbitClass(orbit(radius, 0)), "meo");
});

Deno.test("an eccentricity of 0.25 is HEO, even below 2,000 km", () => {
    assertEquals(orbitClass(orbit(km(8000), 0.24)), "meo");
    assertEquals(orbitClass(orbit(km(8000), 0.25)), "heo");
    assertEquals(orbitClass(orbit(km(6900), 0.25)), "heo");
});

Deno.test("GEO needs a near-circular orbit within 1,000 km of the geostationary radius", () => {
    assertEquals(orbitClass(orbit(km(42_164), 0)), "geo");
    assertEquals(orbitClass(orbit(km(41_165), 0)), "geo");
    assertEquals(orbitClass(orbit(km(41_164), 0)), "meo");
    assertEquals(orbitClass(orbit(km(43_163), 0)), "geo");
    assertEquals(orbitClass(orbit(km(43_164), 0)), "meo");
    assertEquals(orbitClass(orbit(km(42_164), 0.09)), "geo");
    assertEquals(orbitClass(orbit(km(42_164), 0.1)), "meo");
});
