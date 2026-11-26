/// <reference types="deno" />

import { PRESETS, satellites, solarSystem } from "@cpluspatch/catalog";
import { type Elements, km } from "@cpluspatch/orbit";
import { assert, assertEquals } from "@std/assert";
import {
    type OrbitClass,
    type OrbitHost,
    orbitClass,
    synchronousRadius,
} from "./orbit-class.ts";
import { expandBody } from "./presets.ts";
import { spinRateAt } from "./rotation/index.ts";

const solarEarth = solarSystem.bodies.find((body) => body.id === "earth");
assert(solarEarth, "The solar system has no Earth.");

const earth = expandBody(solarEarth, PRESETS);
const { rotation } = earth;
assert(rotation, "Earth has no rotation.");

const host: OrbitHost = {
    mu: earth.mass.mu,
    radius: earth.mass.radius,
    rotation,
};
const bodies = satellites(earth.mass.mu);

const orbit = (a: number, e: number): Elements => ({
    a,
    e,
    i: 0,
    raan: 0,
    argp: 0,
    m0: 0,
    epoch: 0,
});

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
            body.orbit && orbitClass(body.orbit.elements, host),
            expected[body.id],
            body.id,
        );
    }
});

Deno.test("an apoapsis altitude of 2,000 km above the host's radius is the top of LEO", () => {
    const top = host.radius + km(2000);

    assertEquals(orbitClass(orbit(top - 1, 0), host), "leo");
    assertEquals(orbitClass(orbit(top, 0), host), "meo");
});

Deno.test("an eccentricity of 0.25 is HEO, even below 2,000 km", () => {
    assertEquals(orbitClass(orbit(km(8000), 0.24), host), "meo");
    assertEquals(orbitClass(orbit(km(8000), 0.25), host), "heo");
    assertEquals(orbitClass(orbit(km(6900), 0.25), host), "heo");
});

Deno.test("GEO needs a near-circular orbit within 1,000 km of the synchronous radius", () => {
    const rate = Math.abs(spinRateAt(rotation, 0));
    const sync = Math.cbrt(host.mu / rate ** 2);

    // About 42,164 km for Earth.
    assert(Math.abs(sync - km(42_164)) < km(5));
    assertEquals(orbitClass(orbit(sync, 0), host), "geo");
    assertEquals(orbitClass(orbit(sync - km(1000) + 1, 0), host), "geo");
    assertEquals(orbitClass(orbit(sync - km(1000), 0), host), "meo");
    assertEquals(orbitClass(orbit(sync + km(1000) - 1, 0), host), "geo");
    assertEquals(orbitClass(orbit(sync + km(1000), 0), host), "meo");
    assertEquals(orbitClass(orbit(sync, 0.09), host), "geo");
    assertEquals(orbitClass(orbit(sync, 0.1), host), "meo");
});

Deno.test("a host with no rotation, or a still one, has no GEO", () => {
    const still = { mu: host.mu, radius: host.radius };

    const stopped: OrbitHost = {
        ...still,
        rotation: {
            type: "uniform",
            pole: { x: 0, y: 0, z: 1 },
            w0: 0,
            rate: 0,
        },
    };

    assertEquals(orbitClass(orbit(km(42_164), 0), still), "meo");
    assertEquals(orbitClass(orbit(km(42_164), 0), stopped), "meo");
});

Deno.test("a made-up host's own mass, radius and spin set its bands", () => {
    const mu = 4e14;
    const rate = 1e-4;
    const pole = { x: 0, y: 0, z: 1 };
    const made: OrbitHost = {
        mu,
        radius: 1e6,
        rotation: { type: "uniform", pole, w0: 0, rate },
    };
    const sync = Math.cbrt(mu / rate ** 2);

    assertEquals(orbitClass(orbit(2.5e6, 0), made), "leo");
    assertEquals(orbitClass(orbit(3.1e6, 0), made), "meo");
    assertEquals(orbitClass(orbit(sync, 0), made), "geo");

    // The sign of the spin doesn't matter.
    const backwards: OrbitHost = {
        ...made,
        rotation: { type: "uniform", pole, w0: 0, rate: -rate },
    };

    assertEquals(orbitClass(orbit(sync, 0), backwards), "geo");
});

Deno.test("Earth's synchronous radius is the geostationary 42,164 km", () => {
    const radius = synchronousRadius(host, 0);

    assert(radius !== null);
    assert(Math.abs(radius - km(42_164)) < km(1), `got ${radius} m`);
});

Deno.test("a host with no rotation or no spin has no synchronous radius", () => {
    assertEquals(
        synchronousRadius({ mu: host.mu, radius: host.radius }, 0),
        null,
    );
    assertEquals(
        synchronousRadius(
            {
                ...host,
                rotation: {
                    type: "uniform",
                    pole: { x: 0, y: 0, z: 1 },
                    w0: 0,
                    rate: 0,
                },
            },
            0,
        ),
        null,
    );
});
