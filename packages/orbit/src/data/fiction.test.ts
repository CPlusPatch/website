/// <reference types="deno" />
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import { period } from "../kepler.ts";
import { validateScenario } from "../scenario.ts";
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
