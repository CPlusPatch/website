/// <reference types="deno" />

import { builtInScenarios, kerbol, solarSystem } from "@cpluspatch/catalog";
import { MAX_TIME, MIN_TIME } from "@cpluspatch/orbit";
import { assert, assertEquals, assertExists } from "@std/assert";
import type { OrbitingBody, Scenario } from "./scenario.ts";
import {
    isOrbiting,
    MAX_BODIES,
    MAX_NAME,
    sortByDepth,
    validateScenario,
} from "./scenario.ts";

const valid: Scenario = {
    version: 3,
    name: "Tiny",
    bodies: [
        {
            id: "sun",
            name: "Sun",
            tags: ["star"],
            mass: { mu: 1.3e20, radius: 7e8 },
        },
        {
            id: "earth",
            name: "Earth",
            tags: ["planet"],
            mass: { mu: 4e14, radius: 6.4e6 },
            orbit: {
                parent: "sun",
                elements: {
                    a: 1.5e11,
                    e: 0.02,
                    i: 0.1,
                    raan: 1,
                    argp: 2,
                    m0: 3,
                    epoch: 0,
                },
            },
        },
    ],
};

/** The tiny scenario as a version 1 or 2 file wrote it, with a kind and no tags. */
const legacy = (version: 1 | 2): Record<string, unknown> => {
    const { bodies, ...rest } = structuredClone(valid);

    return {
        ...rest,
        version,
        bodies: bodies.map(({ tags, mass, orbit, ...body }) => ({
            ...body,
            kind: tags[0],
            ...mass,
            parent: orbit?.parent ?? null,
            elements: orbit?.elements ?? null,
        })),
    };
};

const legacyBody = (scenario: Record<string, unknown>, index: number) =>
    (scenario.bodies as Record<string, unknown>[])[index] as Record<
        string,
        unknown
    >;

/** Applies `change` to a clone of the tiny scenario and returns the validation errors. */
const at = <T>(items: readonly T[], index: number): T => {
    const item = items[index];

    assertExists(item, `no item at index ${index}`);

    return item;
};

const errorsAfter = (change: (s: Scenario) => void): string[] => {
    const scenario = structuredClone(valid);

    change(scenario);

    const result = validateScenario(scenario);

    assert(!result.ok, "expected the scenario to be rejected");

    return result.errors;
};

const planet = (s: Scenario): OrbitingBody => {
    const body = s.bodies[1];

    if (!body || !isOrbiting(body))
        throw new Error("The scenario has no planet.");

    return body;
};

Deno.test("the solar system is a valid scenario and comes back unchanged", () => {
    const result = validateScenario(solarSystem);

    assert(result.ok);
    assertEquals(result.scenario, solarSystem);
});

Deno.test("a wrong version is rejected", () => {
    const errors = errorsAfter((s) => {
        (s as { version: number }).version = 4;
    });

    assert(errors.includes("version: must be 1, 2 or 3 (got 4)"));
});

Deno.test("the built-in scenarios validate, and Earth has its model", () => {
    for (const scenario of builtInScenarios) {
        const result = validateScenario(scenario);

        assert(result.ok, scenario.name);
        assertEquals(result.scenario, scenario);
    }

    const earth = solarSystem.bodies.find((b) => b.id === "earth");

    assertEquals(earth?.model, "earth");
    assertEquals(solarSystem.hasSatellites, true);
    assertEquals(kerbol.bodies.find((b) => b.id === "kerbin")?.model, "kerbin");
    assert(!("hasSatellites" in kerbol));
});

Deno.test("a version 1 scenario gets models from its ids and satellites for Earth", () => {
    const result = validateScenario(legacy(1));

    assert(result.ok);
    assertEquals(result.scenario.version, 3);
    assertEquals(result.scenario.hasSatellites, true);
    assertEquals(at(result.scenario.bodies, 0).model, "sun");
    assertEquals(at(result.scenario.bodies, 1).model, "earth");
});

Deno.test("a version 1 scenario without Earth has no satellites", () => {
    const old = legacy(1);

    old.bodies = (old.bodies as unknown[]).slice(0, 1);

    const result = validateScenario(old);

    assert(result.ok);
    assertEquals(result.scenario.version, 3);
    assert(!("hasSatellites" in result.scenario));
});

Deno.test("a version 1 body with an unknown id gets no model", () => {
    const old = legacy(1);

    legacyBody(old, 1).id = "my-planet";

    const result = validateScenario(old);

    assert(result.ok);
    assert(!("model" in planet(result.scenario)));
    assert(!("hasSatellites" in result.scenario));
});

Deno.test("a version 1 scenario ignores model and hasSatellites", () => {
    const old = legacy(1);

    legacyBody(old, 1).id = "my-planet";

    const result = validateScenario({
        ...old,
        hasSatellites: true,
        bodies: (old.bodies as object[]).map((body) => ({
            ...body,
            model: "nope",
        })),
    });

    assert(result.ok);
    assertEquals(at(result.scenario.bodies, 0).model, "sun");
    assert(!("model" in planet(result.scenario)));
    assert(!("hasSatellites" in result.scenario));
});

Deno.test("a version 3 body named Earth keeps no model and adds no satellites", () => {
    const result = validateScenario(valid);

    assert(result.ok);
    assert(!("model" in planet(result.scenario)));
    assert(!("hasSatellites" in result.scenario));
});

Deno.test("a model and hasSatellites are kept in version 3", () => {
    const scenario = structuredClone(valid);

    scenario.hasSatellites = true;
    planet(scenario).model = "earth";

    const result = validateScenario(scenario);

    assert(result.ok);
    assertEquals(planet(result.scenario).model, "earth");
    assertEquals(result.scenario.hasSatellites, true);
});

Deno.test("an unknown model is rejected", () => {
    const errors = errorsAfter((s) => {
        Object.assign(planet(s), { model: "krypton" });
    });

    assert(
        errors.includes(
            'earth.model: must be one of the known models (got "krypton")',
        ),
    );
});

Deno.test("hasSatellites other than true is rejected", () => {
    const errors = errorsAfter((s) => {
        Object.assign(s, { hasSatellites: false });
    });

    assert(
        errors.includes("hasSatellites: must be true when set (got boolean)"),
    );
});

Deno.test("an empty body list is rejected", () => {
    const errors = errorsAfter((s) => {
        s.bodies = [];
    });

    assert(errors.includes("bodies: must be a non-empty array"));
});

Deno.test("an id that isn't a slug is rejected and named by its index", () => {
    const errors = errorsAfter((s) => {
        planet(s).id = "Earth!";
    });

    assert(
        errors.includes(
            'bodies[1].id: must match /^[a-z0-9-]+$/ (got "Earth!")',
        ),
    );
});

Deno.test("a duplicate id is rejected", () => {
    const errors = errorsAfter((s) => {
        planet(s).id = "sun";
    });

    assert(errors.includes('sun.id: must be unique (got "sun")'));
});

Deno.test("an unknown kind is rejected in version 2", () => {
    const old = legacy(2);

    legacyBody(old, 1).kind = "rock";

    const result = validateScenario(old);

    assert(!result.ok);
    assert(
        result.errors.includes(
            'earth.kind: must be one of star, planet, dwarf, moon, asteroid, comet, spacecraft (got "rock")',
        ),
    );
});

Deno.test("a negative mu is rejected", () => {
    const errors = errorsAfter((s) => {
        planet(s).mass.mu = -1;
    });

    assert(errors.includes("earth.mass.mu: must be >= 0 (got -1)"));
});

Deno.test("a radius of zero is rejected", () => {
    const errors = errorsAfter((s) => {
        planet(s).mass.radius = 0;
    });

    assert(errors.includes("earth.mass.radius: must be > 0 (got 0)"));
});

Deno.test("a scenario without a root is rejected", () => {
    const errors = errorsAfter((s) => {
        s.bodies = [planet(s)];
    });

    assert(
        errors.includes(
            "bodies: must have exactly one root, with no orbit (got 0)",
        ),
    );
});

Deno.test("a scenario with two roots is rejected", () => {
    const errors = errorsAfter((s) => {
        const { orbit: _orbit, ...root } = planet(s);

        s.bodies[1] = root;
    });

    assert(
        errors.includes(
            "bodies: must have exactly one root, with no orbit (got 2)",
        ),
    );
});

Deno.test("a version 2 root with elements is rejected", () => {
    const old = legacy(2);

    legacyBody(old, 0).elements = legacyBody(old, 1).elements;

    const result = validateScenario(old);

    assert(!result.ok);
    assert(
        result.errors.includes(
            "sun.elements: must be null when parent is null",
        ),
    );
});

Deno.test("a version 2 body with a parent but no elements is rejected", () => {
    const old = legacy(2);

    legacyBody(old, 1).elements = null;

    const result = validateScenario(old);

    assert(!result.ok);
    assert(
        result.errors.includes(
            "earth.elements: must be set when parent is set",
        ),
    );
});

Deno.test("an orbit of null is rejected in version 3", () => {
    const errors = errorsAfter((s) => {
        Object.assign(planet(s), { orbit: null });
    });

    assert(errors.includes("earth.orbit: must be an object (got null)"));
});

Deno.test("a body without mass is rejected in version 3", () => {
    const errors = errorsAfter((s) => {
        Object.assign(planet(s), { mass: undefined });
    });

    assert(errors.includes("earth.mass: must be an object (got undefined)"));
});

Deno.test("precession without an orbit is rejected in version 3", () => {
    const errors = errorsAfter((s) => {
        Object.assign(at(s.bodies, 0), {
            precession: {
                pole: { x: 0, y: 0, z: 1 },
                nodeRate: 0,
                argpRate: 0,
            },
        });
    });

    assert(
        errors.includes("sun.precession: must be absent when orbit is absent"),
    );
});

Deno.test("version 3 errors name the nested field", () => {
    const errors = errorsAfter((s) => {
        planet(s).orbit.parent = "venus";
        planet(s).orbit.elements.a = -1;
    });

    assertEquals(errors, [
        "earth.orbit.elements.a: must be > 0 (got -1)",
        'earth.orbit.parent: no body has the id "venus"',
    ]);
});

Deno.test("a version 3 orbit needs a string parent and elements", () => {
    const errors = errorsAfter((s) => {
        Object.assign(planet(s), { orbit: { elements: null } });
    });

    assert(
        errors.includes("earth.orbit.parent: must be a string (got undefined)"),
    );
    assert(
        errors.includes("earth.orbit.elements: must be an object (got null)"),
    );
});

Deno.test("a version 2 body migrates to mass and orbit, and the root has no orbit", () => {
    const result = validateScenario(legacy(2));

    assert(result.ok);
    assertEquals(result.scenario.bodies, valid.bodies);
    assert(!("orbit" in at(result.scenario.bodies, 0)));
});

Deno.test("version 2 errors name the flat field", () => {
    const old = legacy(2);

    legacyBody(old, 1).mu = -1;
    legacyBody(old, 1).parent = "venus";
    (legacyBody(old, 1).elements as Record<string, number>).a = -1;

    const result = validateScenario(old);

    assert(!result.ok);
    assert(result.errors.includes("earth.mu: must be >= 0 (got -1)"));
    assert(result.errors.includes("earth.elements.a: must be > 0 (got -1)"));
    assert(result.errors.includes('earth.parent: no body has the id "venus"'));
});

Deno.test("a parent that doesn't exist is rejected", () => {
    const errors = errorsAfter((s) => {
        planet(s).orbit.parent = "venus";
    });

    assert(errors.includes('earth.orbit.parent: no body has the id "venus"'));
});

Deno.test("a parent cycle is rejected", () => {
    const errors = errorsAfter((s) => {
        const a = {
            ...planet(s),
            id: "a",
            orbit: { ...planet(s).orbit, parent: "b" },
        };
        const b = {
            ...planet(s),
            id: "b",
            orbit: { ...planet(s).orbit, parent: "a" },
        };

        s.bodies = [at(s.bodies, 0), a, b];
    });

    assert(
        errors.includes(
            "a.orbit.parent: the parent chain loops back on itself",
        ),
    );
    assert(
        errors.includes(
            "b.orbit.parent: the parent chain loops back on itself",
        ),
    );
});

Deno.test("a body whose chain runs into a cycle is rejected, and one beside it isn't", () => {
    const errors = errorsAfter((s) => {
        const a = {
            ...planet(s),
            id: "a",
            orbit: { ...planet(s).orbit, parent: "b" },
        };
        const b = {
            ...planet(s),
            id: "b",
            orbit: { ...planet(s).orbit, parent: "a" },
        };
        const tail = {
            ...planet(s),
            id: "tail",
            orbit: { ...planet(s).orbit, parent: "a" },
        };

        s.bodies = [at(s.bodies, 0), tail, a, b, planet(s)];
    });
    const looping = errors.filter((error) =>
        error.endsWith("loops back on itself"),
    );

    assertEquals(looping, [
        "tail.orbit.parent: the parent chain loops back on itself",
        "a.orbit.parent: the parent chain loops back on itself",
        "b.orbit.parent: the parent chain loops back on itself",
    ]);
});

Deno.test("a long chain of moons is accepted", () => {
    const scenario = structuredClone(valid);
    const chain = Array.from({ length: 400 }, (_, index) => ({
        ...planet(scenario),
        id: `m${index}`,
        orbit: {
            ...planet(scenario).orbit,
            parent: index === 0 ? "earth" : `m${index - 1}`,
        },
    }));

    scenario.bodies.push(...chain);

    assert(validateScenario(scenario).ok);
});

Deno.test("a number that isn't finite is rejected", () => {
    const errors = errorsAfter((s) => {
        planet(s).orbit.elements.a = Number.NaN;
    });

    assert(
        errors.includes(
            "earth.orbit.elements.a: must be a finite number (got NaN)",
        ),
    );
});

Deno.test("an eccentricity of 1 or more is rejected", () => {
    const errors = errorsAfter((s) => {
        planet(s).orbit.elements.e = 1.2;
    });

    assert(errors.includes("earth.orbit.elements.e: must be < 1 (got 1.2)"));
});

Deno.test("an inclination above π is rejected", () => {
    const errors = errorsAfter((s) => {
        planet(s).orbit.elements.i = 4;
    });

    assert(
        errors.includes("earth.orbit.elements.i: must be in [0, π] (got 4)"),
    );
});

Deno.test("every error is reported, not only the first", () => {
    const errors = errorsAfter((s) => {
        planet(s).mass.mu = -1;
        planet(s).mass.radius = 0;
    });

    assertEquals(errors.length, 2);
});

Deno.test("angles outside [0, 2π) are wrapped, not rejected", () => {
    const scenario = structuredClone(valid);
    const { elements } = planet(scenario).orbit;

    elements.raan = -1;
    elements.argp = 7;
    elements.m0 = 4 * Math.PI + 1;

    const result = validateScenario(scenario);

    assert(result.ok);

    const wrapped = planet(result.scenario).orbit.elements;

    assertEquals(wrapped.raan, 2 * Math.PI - 1);
    assertEquals(wrapped.argp, 7 - 2 * Math.PI);
    assert(Math.abs(wrapped.m0 - 1) < 1e-12);
});

Deno.test("unknown keys are dropped and the input isn't mutated", () => {
    const scenario = structuredClone(valid) as Scenario & { extra?: number };
    scenario.extra = 1;
    Object.assign(planet(scenario), { extra: 2 });
    planet(scenario).orbit.elements.raan = -1;

    const before = structuredClone(scenario);
    const result = validateScenario(scenario);

    assert(result.ok);
    assert(!("extra" in result.scenario));
    assert(!("extra" in planet(result.scenario)));
    assertEquals(scenario, before);
});

Deno.test("time and appearance are kept only when present", () => {
    const withBoth = structuredClone(valid);

    withBoth.time = 5;
    at(withBoth.bodies, 0).appearance = { color: "#ffd700" };

    const kept = validateScenario(withBoth);
    const plain = validateScenario(valid);

    assert(kept.ok && plain.ok);
    assertEquals(kept.scenario.time, 5);
    assertEquals(at(kept.scenario.bodies, 0).appearance, { color: "#ffd700" });
    assert(!("time" in plain.scenario));
    assert(!("appearance" in at(plain.scenario.bodies, 0)));
});

Deno.test("an appearance round-trips untouched without a validator", () => {
    const scenario = structuredClone(valid);
    const appearance = { color: "red", clouds: { cover: 0.5 } };

    at(scenario.bodies, 1).appearance = appearance;

    const result = validateScenario(scenario);

    assert(result.ok);
    assertEquals(at(result.scenario.bodies, 1).appearance, appearance);
});

Deno.test("an appearance that isn't an object is rejected", () => {
    for (const appearance of ["#fff", 5, null, ["a"]]) {
        const errors = errorsAfter((s) => {
            planet(s).appearance = appearance;
        });

        assertEquals(errors.length, 1);
        assert(
            errors[0]?.startsWith("earth.appearance: must be an object (got "),
            String(errors[0]),
        );
    }
});

Deno.test("a version 3 body's top-level color is ignored", () => {
    const scenario = structuredClone(valid);

    Object.assign(at(scenario.bodies, 1), { color: "gold" });

    const result = validateScenario(scenario);

    assert(result.ok);
    assert(!("color" in at(result.scenario.bodies, 1)));
    assert(!("appearance" in at(result.scenario.bodies, 1)));
});

Deno.test("the appearance validator gets the path and its result is kept", () => {
    const scenario = structuredClone(valid);
    const calls: [string, unknown][] = [];

    at(scenario.bodies, 1).appearance = { color: "bad" };

    const result = validateScenario(scenario, {
        appearance: (path, input, errors) => {
            calls.push([path, input]);
            errors.push(`${path}.color: nope`);

            return { cleaned: true };
        },
    });

    assertEquals(calls, [["earth.appearance", { color: "bad" }]]);
    assert(!result.ok);
    assertEquals(result.errors, ["earth.appearance.color: nope"]);

    const clean = validateScenario(scenario, { appearance: () => ({ a: 1 }) });

    assert(clean.ok);
    assertEquals(at(clean.scenario.bodies, 1).appearance, { a: 1 });
});

Deno.test("the appearance validator doesn't run on bodies without one", () => {
    let called = false;
    const result = validateScenario(valid, {
        appearance: () => {
            called = true;

            return {};
        },
    });

    assert(result.ok);
    assert(!called);
});

Deno.test("a version 2 colour becomes appearance.color", () => {
    const old = legacy(2);

    legacyBody(old, 1).color = "#ffd700";

    const result = validateScenario(old, {
        appearance: () => {
            throw new Error("the validator doesn't run on a migrated colour");
        },
    });

    assert(result.ok);
    assertEquals(at(result.scenario.bodies, 1).appearance, {
        color: "#ffd700",
    });
    assert(!("color" in at(result.scenario.bodies, 1)));
});

Deno.test("a version 2 kind becomes the only tag", () => {
    const result = validateScenario(legacy(2));

    assert(result.ok);
    assertEquals(result.scenario.version, 3);
    assertEquals(at(result.scenario.bodies, 0).tags, ["star"]);
    assertEquals(planet(result.scenario).tags, ["planet"]);
    assert(!("kind" in planet(result.scenario)));
});

Deno.test("a version 2 spacecraft role becomes the tag after its kind", () => {
    const old = legacy(2);

    Object.assign(legacyBody(old, 1), {
        kind: "spacecraft",
        role: "telescope",
    });

    const result = validateScenario(old);

    assert(result.ok);
    assertEquals(planet(result.scenario).tags, ["spacecraft", "telescope"]);
    assert(!("role" in planet(result.scenario)));
    assertEquals(at(result.scenario.bodies, 0).tags, ["star"]);
});

Deno.test("a version 1 kind becomes the only tag", () => {
    const result = validateScenario(legacy(1));

    assert(result.ok);
    assertEquals(planet(result.scenario).tags, ["planet"]);
});

Deno.test("an unknown role is rejected in version 2", () => {
    const old = legacy(2);

    Object.assign(legacyBody(old, 1), { kind: "spacecraft", role: "tug" });

    const result = validateScenario(old);

    assert(!result.ok);
    assert(
        result.errors.includes(
            'earth.role: must be one of station, telescope, navigation, earth-observation, science (got "tug")',
        ),
    );
});

Deno.test("a role on another kind is rejected in version 2", () => {
    const old = legacy(2);

    legacyBody(old, 1).role = "station";

    const result = validateScenario(old);

    assert(!result.ok);
    assert(
        result.errors.includes(
            "earth.role: must be absent unless kind is spacecraft",
        ),
    );
});

Deno.test("tags are kept in order in version 3, known or not", () => {
    const scenario = structuredClone(valid);

    planet(scenario).tags = ["custom", "moon", "planet-9"];

    const result = validateScenario(scenario);

    assert(result.ok);
    assertEquals(result.scenario.version, 3);
    assertEquals(planet(result.scenario).tags, ["custom", "moon", "planet-9"]);
});

Deno.test("a version 3 body ignores a kind and a role", () => {
    const scenario = structuredClone(valid);

    Object.assign(planet(scenario), { kind: "moon", role: "station" });

    const result = validateScenario(scenario);

    assert(result.ok);
    assertEquals(planet(result.scenario).tags, ["planet"]);
    assert(!("kind" in planet(result.scenario)));
    assert(!("role" in planet(result.scenario)));
});

Deno.test("tags that aren't an array of 1 to 8 are rejected", () => {
    const bad: unknown[] = [
        "moon",
        [],
        ["a", "b", "c", "d", "e", "f", "g", "h", "i"],
    ];
    const shown = ['"moon"', "object", "object"];

    for (const [index, tags] of bad.entries()) {
        const errors = errorsAfter((s) => {
            Object.assign(planet(s), { tags });
        });

        assert(
            errors.includes(
                `earth.tags: must be an array of 1 to 8 tags (got ${shown[index]})`,
            ),
            errors.join("\n"),
        );
    }
});

Deno.test("a body without tags is rejected in version 3", () => {
    const errors = errorsAfter((s) => {
        Reflect.deleteProperty(planet(s), "tags");
    });

    assert(
        errors.includes(
            "earth.tags: must be an array of 1 to 8 tags (got undefined)",
        ),
    );
});

Deno.test("eight tags are accepted", () => {
    const scenario = structuredClone(valid);

    planet(scenario).tags = ["a", "b", "c", "d", "e", "f", "g", "h"];

    assert(validateScenario(scenario).ok);
});

Deno.test("a tag that isn't a slug is rejected and named by its index", () => {
    const errors = errorsAfter((s) => {
        planet(s).tags = ["moon", "ok", "Bad Tag", "x"];
    });

    assert(
        errors.includes(
            'earth.tags[2]: must match /^[a-z0-9-]+$/ (got "Bad Tag")',
        ),
    );
});

Deno.test("a tag that isn't a string is rejected", () => {
    const errors = errorsAfter((s) => {
        Object.assign(planet(s), { tags: ["moon", 3] });
    });

    assert(errors.includes("earth.tags[1]: must match /^[a-z0-9-]+$/ (got 3)"));
});

Deno.test("a duplicate tag is rejected", () => {
    const errors = errorsAfter((s) => {
        planet(s).tags = ["moon", "x", "moon"];
    });

    assert(errors.includes('earth.tags: must be unique (got "moon" twice)'));
});

Deno.test("sorting puts every body after its parent", () => {
    const reversed: Scenario = {
        ...solarSystem,
        bodies: [...solarSystem.bodies].reverse(),
    };

    for (const scenario of [solarSystem, reversed]) {
        const sorted = sortByDepth(scenario);
        const seen = new Set<string | null>([null]);

        assertEquals(sorted.length, scenario.bodies.length);

        for (const body of sorted) {
            assert(
                seen.has(body.orbit?.parent ?? null),
                `${body.id} comes before ${body.orbit?.parent}`,
            );
            seen.add(body.id);
        }
    }
});

const withPrecession = (precession: unknown) => {
    const scenario = structuredClone(valid) as Record<string, unknown>;
    const bodies = scenario.bodies as Record<string, unknown>[];

    at(bodies, 1).precession = precession;

    return scenario;
};

const precession = {
    pole: { x: 0, y: 0, z: 1 },
    nodeRate: 1e-8,
    argpRate: 2e-8,
};

Deno.test("a valid precession is accepted and its pole normalised", () => {
    const result = validateScenario(
        withPrecession({ ...precession, pole: { x: 0, y: 0, z: 1 + 5e-7 } }),
    );

    assert(result.ok);
    assertEquals(at(result.scenario.bodies, 1).precession, precession);
});

Deno.test("a precession with a pole that isn't a unit vector is rejected", () => {
    const result = validateScenario(
        withPrecession({ ...precession, pole: { x: 0, y: 0, z: 1.01 } }),
    );

    assert(!result.ok);
    assert(at(result.errors, 0).startsWith("earth.precession.pole: must be"));
});

Deno.test("a precession with a rate that isn't finite is rejected", () => {
    const result = validateScenario(
        withPrecession({ ...precession, nodeRate: Number.NaN }),
    );

    assert(!result.ok);
    assert(
        at(result.errors, 0).startsWith("earth.precession.nodeRate: must be"),
    );
});

Deno.test("a precession that isn't an object is rejected", () => {
    const result = validateScenario(withPrecession(3));

    assert(!result.ok);
    assert(
        at(result.errors, 0).startsWith("earth.precession: must be an object"),
    );
});

Deno.test("a precession on the root is rejected", () => {
    const scenario = withPrecession(precession);

    at(scenario.bodies as Record<string, unknown>[], 0).precession = precession;

    const result = validateScenario(scenario);

    assert(!result.ok);
    assert(result.errors.some((e) => e.startsWith("sun.precession: must be")));
});

Deno.test("a body without precession has no precession key", () => {
    const result = validateScenario(valid);

    assert(result.ok);
    assert(!("precession" in at(result.scenario.bodies, 1)));
});

Deno.test("a version 2 colour that isn't #rgb or #rrggbb is rejected", () => {
    for (const color of [
        "gold",
        "#12",
        "#12345",
        "#ggg",
        "rgb(0 0 0)",
        "var(--x)",
    ]) {
        const old = legacy(2);

        legacyBody(old, 1).color = color;

        const result = validateScenario(old);

        assert(!result.ok);
        assertEquals(result.errors, [
            `earth.color: must be a #rgb or #rrggbb colour (got ${JSON.stringify(color)})`,
        ]);
    }
});

Deno.test("version 2 #rgb and #rrggbb colours are accepted in either case", () => {
    for (const color of ["#abc", "#AABBCC"]) {
        const old = legacy(2);

        legacyBody(old, 0).color = color;

        const result = validateScenario(old);

        assert(result.ok, color);
        assertEquals(at(result.scenario.bodies, 0).appearance, { color });
    }
});

Deno.test("a version 2 colour that isn't a string is rejected", () => {
    const old = legacy(2);

    legacyBody(old, 1).color = 5;

    const result = validateScenario(old);

    assert(!result.ok);
    assertEquals(result.errors, ["earth.color: must be a string (got 5)"]);
});

Deno.test("a body name over the limit is rejected", () => {
    const errors = errorsAfter((s) => {
        planet(s).name = "x".repeat(MAX_NAME + 1);
    });

    assertEquals(errors, [
        `earth.name: must be at most ${MAX_NAME} characters (got ${MAX_NAME + 1})`,
    ]);
});

Deno.test("a scenario name over the limit is rejected, and one at the limit is kept", () => {
    const errors = errorsAfter((s) => {
        s.name = "x".repeat(MAX_NAME + 1);
    });
    const atLimit = validateScenario({ ...valid, name: "x".repeat(MAX_NAME) });

    assertEquals(errors, [
        `name: must be at most ${MAX_NAME} characters (got ${MAX_NAME + 1})`,
    ]);
    assert(atLimit.ok);
});

Deno.test("more bodies than the limit are rejected with one error", () => {
    const errors = errorsAfter((s) => {
        s.bodies = Array.from({ length: MAX_BODIES + 1 }, () =>
            structuredClone(at(s.bodies, 0)),
        );
    });

    assertEquals(errors, [
        `bodies: must have at most ${MAX_BODIES} bodies (got ${MAX_BODIES + 1})`,
    ]);
});

Deno.test("a scenario time outside the year bounds is rejected", () => {
    for (const time of [MIN_TIME - 1, MAX_TIME + 1]) {
        const errors = errorsAfter((s) => {
            s.time = time;
        });

        assertEquals(errors.length, 1);
        assert(
            at(errors, 0).startsWith("time: must be in years -9999 to 9999"),
            at(errors, 0),
        );
    }

    const scenario = { ...structuredClone(valid), time: MAX_TIME };

    assert(validateScenario(scenario).ok);
});

Deno.test("an element epoch outside the year bounds is rejected", () => {
    for (const epoch of [MIN_TIME - 1, MAX_TIME + 1]) {
        const errors = errorsAfter((s) => {
            planet(s).orbit.elements.epoch = epoch;
        });

        assertEquals(errors.length, 1);
        assert(
            at(errors, 0).startsWith(
                "earth.orbit.elements.epoch: must be in years -9999 to 9999",
            ),
            at(errors, 0),
        );
    }
});
