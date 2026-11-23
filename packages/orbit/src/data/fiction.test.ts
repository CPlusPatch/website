/// <reference types="deno" />
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import { period, stateAt } from "../kepler.ts";
import { bodyOrientation } from "../orientation.ts";
import { validateScenario } from "../scenario.ts";
import { dot, length, scale } from "../vec.ts";
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

    assert(root && miller?.elements);
    assert(miller.elements.a > root.radius);
    assertAlmostEquals(
        period(miller.elements, root.mu + miller.mu),
        1.7 * 3600,
        1,
    );
});

Deno.test("Kerbin goes round Kerbol in the game's 9,203,545 seconds", () => {
    const root = kerbol.bodies[0];
    const kerbin = kerbol.bodies.find(({ id }) => id === "kerbin");

    assert(root && kerbin?.elements);
    assertAlmostEquals(
        period(kerbin.elements, root.mu + kerbin.mu),
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
    assert(mun.elements);

    const { r } = stateAt(mun.elements, kerbin.mu + mun.mu, t);
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
