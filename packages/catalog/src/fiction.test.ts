/// <reference types="deno" />

import {
    DAY,
    dot,
    length,
    meanMotion,
    period,
    scale,
    stateAt,
} from "@cpluspatch/orbit";
import {
    bodyOrientation,
    isOrbiting,
    KERBOL_LOCKED,
    validateScenario,
} from "@cpluspatch/sim";
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import { builtInScenarios } from "./built-in.ts";
import { gargantua, kerbol } from "./fiction.ts";

Deno.test("every built-in scenario is valid and keeps its values", () => {
    for (const scenario of builtInScenarios) {
        const result = validateScenario(scenario);

        assert(result.ok, `${scenario.name} isn't valid`);
        assertEquals(result.scenario, scenario);
    }
});

Deno.test("the built-in scenarios have unique names, solar system first", () => {
    const names = builtInScenarios.map(({ name }) => name);

    assertEquals(names[0], "Solar System");
    assertEquals(new Set(names).size, names.length);
});

Deno.test("Miller's planet orbits outside Gargantua's horizon in 1.7 hours", () => {
    const [root, miller] = gargantua.bodies;

    assert(root && miller && isOrbiting(miller));
    assert(miller.orbit.elements.a > root.mass.radius);
    assertAlmostEquals(
        period(miller.orbit.elements, root.mass.mu + miller.mass.mu),
        1.7 * 3600,
        1,
    );
});

Deno.test("Kerbin goes round Kerbol in the game's 9,203,545 seconds", () => {
    const root = kerbol.bodies[0];
    const kerbin = kerbol.bodies.find(({ id }) => id === "kerbin");

    assert(root && kerbin && isOrbiting(kerbin));
    assertAlmostEquals(
        period(kerbin.orbit.elements, root.mass.mu + kerbin.mass.mu),
        9_203_545,
        100,
    );
});

const kerbolBody = (id: string) => {
    const body = kerbol.bodies.find((b) => b.id === id);
    assert(body);

    return body;
};

Deno.test("the Mun's prime meridian faces Kerbin years after the epoch", () => {
    const kerbin = kerbolBody("kerbin");
    const mun = kerbolBody("mun");
    const t = 30 * 365.25 * 86_400;
    assert(isOrbiting(mun));

    const { r } = stateAt(mun.orbit.elements, kerbin.mass.mu + mun.mass.mu, t);
    const toKerbin = scale(r, -1 / length(r));
    const orientation = bodyOrientation("mun", t);

    assert(orientation);
    assertAlmostEquals(dot(orientation.x, toKerbin), 1, 1e-6);
});

Deno.test("Kerbin turns once in the game's 21,549.425 seconds, about the ecliptic pole", () => {
    const start = bodyOrientation("kerbin", 1e6);
    const end = bodyOrientation("kerbin", 1e6 + 21_549.425);

    assert(start && end);
    assertAlmostEquals(dot(start.x, end.x), 1, 1e-9);
    assertAlmostEquals(start.z.z, 1, 1e-12);
});

Deno.test("the locked Kerbol bodies' phase and rate match their orbits exactly", () => {
    // Each locked body and the body it faces. Duna is locked to Ike, which orbits it.
    const partners: Record<string, string> = {
        mun: "kerbin",
        ike: "duna",
        duna: "ike",
        laythe: "jool",
        vall: "jool",
        tylo: "jool",
        bop: "jool",
        pol: "jool",
    };

    assertEquals(
        Object.keys(KERBOL_LOCKED).sort(),
        Object.keys(partners).sort(),
    );

    for (const [id, partner] of Object.entries(partners)) {
        const moon = kerbolBody(
            kerbolBody(id).orbit?.parent === partner ? id : partner,
        );
        const parent = kerbol.bodies.find(
            (body) => body.id === moon.orbit?.parent,
        );
        assert(isOrbiting(moon) && parent);

        const { raan, argp, m0 } = moon.orbit.elements;
        const n = meanMotion(
            moon.orbit.elements,
            parent.mass.mu + moon.mass.mu,
        );
        const rate = (n * DAY * 180) / Math.PI;
        const w0 =
            ((raan + argp + m0) * 180) / Math.PI + (moon.id === id ? 180 : 0);

        assertEquals(KERBOL_LOCKED[id], { w0, rate }, id);
    }
});
