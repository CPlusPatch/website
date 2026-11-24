/// <reference types="deno" />
import { assert, assertEquals } from "@std/assert";
import { solarSystem } from "./data/solar-system.ts";
import type { OrbitingBody, Scenario } from "./scenario.ts";
import {
    MAX_BODIES,
    MAX_NAME,
    sortByDepth,
    validateScenario,
} from "./scenario.ts";
import { MAX_TIME, MIN_TIME } from "./time.ts";

const valid: Scenario = {
    version: 1,
    name: "Tiny",
    bodies: [
        {
            id: "sun",
            name: "Sun",
            kind: "star",
            parent: null,
            mu: 1.3e20,
            radius: 7e8,
            elements: null,
        },
        {
            id: "earth",
            name: "Earth",
            kind: "planet",
            parent: "sun",
            mu: 4e14,
            radius: 6.4e6,
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
    ],
};

/** Applies `change` to a clone of the tiny scenario and returns the validation errors. */
const errorsAfter = (change: (s: Scenario) => void): string[] => {
    const scenario = structuredClone(valid);

    change(scenario);

    const result = validateScenario(scenario);

    assert(!result.ok, "expected the scenario to be rejected");

    return result.errors;
};

const planet = (s: Scenario): OrbitingBody => {
    const body = s.bodies[1];

    if (!body || body.parent === null)
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
        (s as { version: number }).version = 2;
    });

    assert(errors.includes("version: must be 1 (got 2)"));
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
        planet(s).parent = "sun";
    });

    assert(errors.includes('sun.id: must be unique (got "sun")'));
});

Deno.test("an unknown kind is rejected", () => {
    const errors = errorsAfter((s) => {
        (planet(s) as { kind: string }).kind = "rock";
    });

    assert(
        errors.includes(
            'earth.kind: must be one of star, planet, dwarf, moon, asteroid, comet, spacecraft (got "rock")',
        ),
    );
});

Deno.test("a negative mu is rejected", () => {
    const errors = errorsAfter((s) => {
        planet(s).mu = -1;
    });

    assert(errors.includes("earth.mu: must be >= 0 (got -1)"));
});

Deno.test("a radius of zero is rejected", () => {
    const errors = errorsAfter((s) => {
        planet(s).radius = 0;
    });

    assert(errors.includes("earth.radius: must be > 0 (got 0)"));
});

Deno.test("a scenario without a root is rejected", () => {
    const errors = errorsAfter((s) => {
        s.bodies = [planet(s)];
    });

    assert(
        errors.includes(
            "bodies: must have exactly one root, with parent null (got 0)",
        ),
    );
});

Deno.test("a scenario with two roots is rejected", () => {
    const errors = errorsAfter((s) => {
        Object.assign(planet(s), { parent: null, elements: null });
    });

    assert(
        errors.includes(
            "bodies: must have exactly one root, with parent null (got 2)",
        ),
    );
});

Deno.test("a root with elements is rejected", () => {
    const errors = errorsAfter((s) => {
        s.bodies[0].elements = structuredClone(planet(s).elements);
    });

    assert(errors.includes("sun.elements: must be null when parent is null"));
});

Deno.test("a body with a parent but no elements is rejected", () => {
    const errors = errorsAfter((s) => {
        Object.assign(planet(s), { elements: null });
    });

    assert(errors.includes("earth.elements: must be set when parent is set"));
});

Deno.test("a parent that doesn't exist is rejected", () => {
    const errors = errorsAfter((s) => {
        planet(s).parent = "venus";
    });

    assert(errors.includes('earth.parent: no body has the id "venus"'));
});

Deno.test("a parent cycle is rejected", () => {
    const errors = errorsAfter((s) => {
        const a = { ...planet(s), id: "a", parent: "b" };
        const b = { ...planet(s), id: "b", parent: "a" };

        s.bodies = [s.bodies[0], a, b];
    });

    assert(errors.includes("a.parent: the parent chain loops back on itself"));
    assert(errors.includes("b.parent: the parent chain loops back on itself"));
});

Deno.test("a body whose chain runs into a cycle is rejected, and one beside it isn't", () => {
    const errors = errorsAfter((s) => {
        const a = { ...planet(s), id: "a", parent: "b" };
        const b = { ...planet(s), id: "b", parent: "a" };
        const tail = { ...planet(s), id: "tail", parent: "a" };

        s.bodies = [s.bodies[0], tail, a, b, planet(s)];
    });
    const looping = errors.filter((error) =>
        error.endsWith("loops back on itself"),
    );

    assertEquals(looping, [
        "tail.parent: the parent chain loops back on itself",
        "a.parent: the parent chain loops back on itself",
        "b.parent: the parent chain loops back on itself",
    ]);
});

Deno.test("a long chain of moons is accepted", () => {
    const scenario = structuredClone(valid);
    const chain = Array.from({ length: 400 }, (_, index) => ({
        ...planet(scenario),
        id: `m${index}`,
        parent: index === 0 ? "earth" : `m${index - 1}`,
    }));

    scenario.bodies.push(...chain);

    assert(validateScenario(scenario).ok);
});

Deno.test("a number that isn't finite is rejected", () => {
    const errors = errorsAfter((s) => {
        const elements = planet(s).elements;

        if (elements) {
            elements.a = Number.NaN;
        }
    });

    assert(
        errors.includes("earth.elements.a: must be a finite number (got NaN)"),
    );
});

Deno.test("an eccentricity of 1 or more is rejected", () => {
    const errors = errorsAfter((s) => {
        const elements = planet(s).elements;

        if (elements) {
            elements.e = 1.2;
        }
    });

    assert(errors.includes("earth.elements.e: must be < 1 (got 1.2)"));
});

Deno.test("an inclination above π is rejected", () => {
    const errors = errorsAfter((s) => {
        const elements = planet(s).elements;

        if (elements) {
            elements.i = 4;
        }
    });

    assert(errors.includes("earth.elements.i: must be in [0, π] (got 4)"));
});

Deno.test("every error is reported, not only the first", () => {
    const errors = errorsAfter((s) => {
        planet(s).mu = -1;
        planet(s).radius = 0;
    });

    assertEquals(errors.length, 2);
});

Deno.test("angles outside [0, 2π) are wrapped, not rejected", () => {
    const scenario = structuredClone(valid);
    const elements = planet(scenario).elements;

    if (elements) {
        elements.raan = -1;
        elements.argp = 7;
        elements.m0 = 4 * Math.PI + 1;
    }

    const result = validateScenario(scenario);

    assert(result.ok);

    const wrapped = planet(result.scenario).elements;

    assert(wrapped);
    assertEquals(wrapped.raan, 2 * Math.PI - 1);
    assertEquals(wrapped.argp, 7 - 2 * Math.PI);
    assert(Math.abs(wrapped.m0 - 1) < 1e-12);
});

Deno.test("unknown keys are dropped and the input isn't mutated", () => {
    const scenario = structuredClone(valid) as Scenario & { extra?: number };
    const elements = planet(scenario).elements;

    scenario.extra = 1;
    Object.assign(planet(scenario), { extra: 2 });

    if (elements) {
        elements.raan = -1;
    }

    const before = structuredClone(scenario);
    const result = validateScenario(scenario);

    assert(result.ok);
    assert(!("extra" in result.scenario));
    assert(!("extra" in planet(result.scenario)));
    assertEquals(scenario, before);
});

Deno.test("time and color are kept only when present", () => {
    const withBoth = structuredClone(valid);

    withBoth.time = 5;
    withBoth.bodies[0].color = "#ffd700";

    const kept = validateScenario(withBoth);
    const plain = validateScenario(valid);

    assert(kept.ok && plain.ok);
    assertEquals(kept.scenario.time, 5);
    assertEquals(kept.scenario.bodies[0].color, "#ffd700");
    assert(!("time" in plain.scenario));
    assert(!("color" in plain.scenario.bodies[0]));
});

Deno.test("a spacecraft role is kept", () => {
    const scenario = structuredClone(valid);

    scenario.bodies[1].kind = "spacecraft";
    scenario.bodies[1].role = "telescope";

    const result = validateScenario(scenario);

    assert(result.ok);
    assertEquals(planet(result.scenario).role, "telescope");
    assert(!("role" in result.scenario.bodies[0]));
});

Deno.test("an unknown role is rejected", () => {
    const errors = errorsAfter((s) => {
        planet(s).kind = "spacecraft";
        (planet(s) as { role: string }).role = "tug";
    });

    assert(
        errors.includes(
            'earth.role: must be one of station, telescope, navigation, earth-observation, science (got "tug")',
        ),
    );
});

Deno.test("a role on another kind is rejected", () => {
    const errors = errorsAfter((s) => {
        planet(s).role = "station";
    });

    assert(
        errors.includes("earth.role: must be absent unless kind is spacecraft"),
    );
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
                seen.has(body.parent),
                `${body.id} comes before ${body.parent}`,
            );
            seen.add(body.id);
        }
    }
});

const withPrecession = (precession: unknown) => {
    const scenario = structuredClone(valid) as Record<string, unknown>;
    const bodies = scenario.bodies as Record<string, unknown>[];

    bodies[1].precession = precession;

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
    assertEquals(result.scenario.bodies[1].precession, precession);
});

Deno.test("a precession with a pole that isn't a unit vector is rejected", () => {
    const result = validateScenario(
        withPrecession({ ...precession, pole: { x: 0, y: 0, z: 1.01 } }),
    );

    assert(!result.ok);
    assert(result.errors[0].startsWith("earth.precession.pole: must be"));
});

Deno.test("a precession with a rate that isn't finite is rejected", () => {
    const result = validateScenario(
        withPrecession({ ...precession, nodeRate: Number.NaN }),
    );

    assert(!result.ok);
    assert(result.errors[0].startsWith("earth.precession.nodeRate: must be"));
});

Deno.test("a precession that isn't an object is rejected", () => {
    const result = validateScenario(withPrecession(3));

    assert(!result.ok);
    assert(result.errors[0].startsWith("earth.precession: must be an object"));
});

Deno.test("a precession on the root is rejected", () => {
    const scenario = withPrecession(precession);

    (scenario.bodies as Record<string, unknown>[])[0].precession = precession;

    const result = validateScenario(scenario);

    assert(!result.ok);
    assert(result.errors.some((e) => e.startsWith("sun.precession: must be")));
});

Deno.test("a body without precession has no precession key", () => {
    const result = validateScenario(valid);

    assert(result.ok);
    assert(!("precession" in result.scenario.bodies[1]));
});

Deno.test("a colour that isn't #rgb or #rrggbb is rejected", () => {
    for (const color of [
        "gold",
        "#12",
        "#12345",
        "#ggg",
        "rgb(0 0 0)",
        "var(--x)",
    ]) {
        const errors = errorsAfter((s) => {
            planet(s).color = color;
        });

        assertEquals(errors, [
            `earth.color: must be a #rgb or #rrggbb colour (got ${JSON.stringify(color)})`,
        ]);
    }
});

Deno.test("#rgb and #rrggbb colours are accepted in either case", () => {
    for (const color of ["#abc", "#AABBCC"]) {
        const scenario = structuredClone(valid);

        scenario.bodies[0].color = color;

        const result = validateScenario(scenario);

        assert(result.ok, color);
        assertEquals(result.scenario.bodies[0].color, color);
    }
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
            structuredClone(s.bodies[0]),
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
            errors[0].startsWith("time: must be in years 1 to 9999"),
            errors[0],
        );
    }

    const scenario = { ...structuredClone(valid), time: MAX_TIME };

    assert(validateScenario(scenario).ok);
});

Deno.test("an element epoch outside the year bounds is rejected", () => {
    for (const epoch of [MIN_TIME - 1, MAX_TIME + 1]) {
        const errors = errorsAfter((s) => {
            const elements = planet(s).elements;

            if (elements) {
                elements.epoch = epoch;
            }
        });

        assertEquals(errors.length, 1);
        assert(
            errors[0].startsWith(
                "earth.elements.epoch: must be in years 1 to 9999",
            ),
            errors[0],
        );
    }
});
