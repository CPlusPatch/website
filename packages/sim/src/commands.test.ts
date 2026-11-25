/// <reference types="deno" />

import { builtInScenarios, PRESETS, solarSystem } from "@cpluspatch/catalog";
import { applyBurn, type Elements, length, stateAt } from "@cpluspatch/orbit";
import { assert, assertEquals } from "@std/assert";
import type { BodyPatch, Command } from "./commands.ts";
import { apply as applyCommand } from "./commands.ts";
import type { Document } from "./document.ts";
import { documentOf } from "./document.ts";
import { bodyOrientation } from "./orientation.ts";
import { precessionsOf } from "./perturb/index.ts";
import { elementsAt, j2Precession } from "./precession.ts";
import type { Body, OrbitingBody } from "./scenario.ts";
import { isOrbiting, subtreeIds } from "./scenario.ts";

const doc = documentOf(solarSystem);

const apply = (document: Document, cmd: Command) =>
    applyCommand(document, cmd, PRESETS);

const orbiting = (id: string): OrbitingBody => {
    const body = solarSystem.bodies.find((candidate) => candidate.id === id);
    assert(body && isOrbiting(body));

    return body;
};

const ok = (result: ReturnType<typeof apply>): Document => {
    assert(result.ok, result.ok ? "" : result.errors.join("; "));

    return result.doc;
};

const errors = (result: ReturnType<typeof apply>): string[] => {
    assert(!result.ok);

    return result.errors;
};

const find = (d: Document, id: string): Body | undefined =>
    d.scenario.bodies.find((body) => body.id === id);

const elements: Elements = {
    a: 1e7,
    e: 0.1,
    i: 0.5,
    raan: 1,
    argp: 2,
    m0: 3,
    epoch: 100,
};

const probe: Body = {
    id: "probe",
    name: "Probe",
    tags: ["spacecraft"],
    mass: { mu: 0, radius: 5 },
    orbit: { parent: "earth", elements },
};

Deno.test("add-body appends the body", () => {
    const next = ok(apply(doc, { type: "add-body", body: probe }));

    assertEquals(next.scenario.bodies.length, doc.scenario.bodies.length + 1);
    assertEquals(next.scenario.bodies.at(-1), probe);
    assertEquals(next.timeline, []);
});

Deno.test("add-body with j2 needs a parent whose preset or own fields give gravity", () => {
    const j2Probe = (parent: string): Body => ({
        ...probe,
        id: "j2-probe",
        orbit: { parent, elements: orbiting("moon").orbit.elements },
        perturbations: [{ type: "j2" }],
    });

    ok(apply(doc, { type: "add-body", body: j2Probe("earth") }));
    const [error] = errors(
        apply(doc, { type: "add-body", body: j2Probe("sun") }),
    );

    assertEquals(error?.startsWith("j2-probe.perturbations[0]"), true);
});

Deno.test("add-body with a taken id returns the validator's error", () => {
    const [error] = errors(
        apply(doc, { type: "add-body", body: { ...probe, id: "moon" } }),
    );

    assert(error?.includes("must be unique"));
});

Deno.test("add-body with an unknown parent is an error", () => {
    errors(
        apply(doc, {
            type: "add-body",
            body: { ...probe, orbit: { parent: "nowhere", elements } },
        }),
    );
});

Deno.test("remove-body drops the body and its subtree", () => {
    const gone = new Set(subtreeIds(solarSystem, "earth"));
    const next = ok(apply(doc, { type: "remove-body", id: "earth" }));

    assert(gone.size > 1);
    assertEquals(
        next.scenario.bodies.map((body) => body.id),
        solarSystem.bodies.map((body) => body.id).filter((id) => !gone.has(id)),
    );
});

Deno.test("remove-body drops the clouds hosted in the subtree", () => {
    const next = ok(apply(doc, { type: "remove-body", id: "earth" }));

    assert(!("clouds" in next.scenario));
});

Deno.test("remove-body keeps the clouds hosted elsewhere", () => {
    const next = ok(apply(doc, { type: "remove-body", id: "iss" }));

    assertEquals(next.scenario.clouds, solarSystem.clouds);
});

Deno.test("remove-body of an unknown id is an error", () => {
    assertEquals(errors(apply(doc, { type: "remove-body", id: "nope" })), [
        'id: there is no body "nope"',
    ]);
});

Deno.test("remove-body of the root is an error", () => {
    assertEquals(errors(apply(doc, { type: "remove-body", id: "sun" })), [
        'id: "sun" is the root.',
    ]);
});

Deno.test("update-body changes the patched fields", () => {
    const next = ok(
        apply(doc, {
            type: "update-body",
            id: "earth",
            patch: {
                name: "Terra",
                mass: { mu: 1, radius: 1 },
                appearance: { color: "#00f" },
            },
        }),
    );
    const earth = find(next, "earth");

    assertEquals(earth?.name, "Terra");
    assertEquals(earth?.mass, { mu: 1, radius: 1 });
    assertEquals(earth?.appearance, { color: "#00f" });
});

Deno.test("update-body can't change id or orbit", () => {
    const patch = {
        name: "Terra",
        id: "other",
        orbit: { parent: "mars", elements },
        perturbations: undefined,
    } as BodyPatch;
    const next = ok(apply(doc, { type: "update-body", id: "moon", patch }));
    const moon = find(next, "moon");

    assertEquals(moon?.name, "Terra");
    assertEquals(moon, { ...orbiting("moon"), name: "Terra" });
    assertEquals(find(next, "other"), undefined);
});

Deno.test("update-body keeps the perturbations", () => {
    const precessing = solarSystem.bodies.find(
        (body) => body.orbit !== undefined && body.perturbations !== undefined,
    );
    assert(precessing?.perturbations);

    const patch = {
        name: "Renamed",
        perturbations: [{ ...precessing.perturbations[0], nodeRate: 1 }],
    } as BodyPatch;
    const next = ok(
        apply(doc, { type: "update-body", id: precessing.id, patch }),
    );

    assertEquals(find(next, precessing.id), {
        ...precessing,
        name: "Renamed",
    });
});

Deno.test("update-body of an unknown id is an error", () => {
    assertEquals(
        errors(
            apply(doc, {
                type: "update-body",
                id: "nope",
                patch: { name: "x" },
            }),
        ),
        ['id: there is no body "nope"'],
    );
});

Deno.test("update-body returns the validator's errors", () => {
    const [error] = errors(
        apply(doc, {
            type: "update-body",
            id: "earth",
            patch: { mass: { mu: 1, radius: -1 } },
        }),
    );

    assert(error?.includes("earth.mass.radius"));
});

Deno.test("set-orbit replaces the elements and drops perturbations", () => {
    const precessing = solarSystem.bodies.find(
        (body) => body.orbit !== undefined && body.perturbations !== undefined,
    );
    assert(precessing);

    const next = ok(
        apply(doc, {
            type: "set-orbit",
            bodyId: precessing.id,
            t: 0,
            elements,
        }),
    );
    const body = find(next, precessing.id);

    assertEquals(body?.orbit?.elements, elements);
    assertEquals(body?.perturbations, undefined);
    assert(!("perturbations" in (body ?? {})));
});

Deno.test("set-orbit of an unknown id or the root is an error", () => {
    assertEquals(
        errors(
            apply(doc, { type: "set-orbit", bodyId: "nope", t: 0, elements }),
        ),
        ['bodyId: there is no body "nope"'],
    );
    assertEquals(
        errors(
            apply(doc, { type: "set-orbit", bodyId: "sun", t: 0, elements }),
        ),
        ['bodyId: "sun" has no parent to orbit.'],
    );
});

Deno.test("set-orbit returns the validator's errors", () => {
    errors(
        apply(doc, {
            type: "set-orbit",
            bodyId: "earth",
            t: 0,
            elements: { ...elements, a: -1 },
        }),
    );
});

Deno.test("schedule-burn gives the elements applyBurn does", () => {
    const earth = orbiting("earth");
    const sun = solarSystem.bodies.find((body) => body.id === "sun");
    const dv = { prograde: 100, normal: 20, radial: -5 };
    const t = 1e7;
    const direct = applyBurn(
        elementsAt(earth.orbit.elements, [], t),
        (sun?.mass.mu ?? 0) + earth.mass.mu,
        t,
        dv,
    );
    assert(direct.ok);

    const next = ok(
        apply(doc, { type: "schedule-burn", bodyId: "earth", t, dv }),
    );

    assertEquals(find(next, "earth")?.orbit?.elements, direct.elements);
    assertEquals(next.timeline, []);
});

Deno.test("schedule-burn drops perturbations like set-orbit", () => {
    const precessing = solarSystem.bodies.find(
        (body) => body.orbit !== undefined && body.perturbations !== undefined,
    );
    assert(precessing);

    const next = ok(
        apply(doc, {
            type: "schedule-burn",
            bodyId: precessing.id,
            t: 0,
            dv: { prograde: 1, normal: 0, radial: 0 },
        }),
    );

    assert(!("perturbations" in (find(next, precessing.id) ?? {})));
});

Deno.test("schedule-burn that escapes is an error naming the body", () => {
    const [error, ...rest] = errors(
        apply(doc, {
            type: "schedule-burn",
            bodyId: "earth",
            t: 0,
            dv: { prograde: 1e9, normal: 0, radial: 0 },
        }),
    );

    assertEquals(rest, []);
    assert(error?.includes('"earth"'));
    assert(error?.includes("leave the parent's gravity"));
});

Deno.test("schedule-burn that stops the body is an error naming the body", () => {
    const moon = orbiting("moon");
    const earth = orbiting("earth");
    const { v } = stateAt(
        elementsAt(moon.orbit.elements, precessionsOf(moon, earth), 0),
        earth.mass.mu + moon.mass.mu,
        0,
    );

    const [error, ...rest] = errors(
        apply(doc, {
            type: "schedule-burn",
            bodyId: "moon",
            t: 0,
            dv: { prograde: -length(v), normal: 0, radial: 0 },
        }),
    );

    assertEquals(rest, []);
    assert(error?.includes('"moon"'));
    assert(error?.includes("no orbit to describe"));
});

Deno.test("schedule-burn of an unknown id or the root is an error", () => {
    const dv = { prograde: 1, normal: 0, radial: 0 };

    assertEquals(
        errors(apply(doc, { type: "schedule-burn", bodyId: "nope", t: 0, dv })),
        ['bodyId: there is no body "nope"'],
    );
    assertEquals(
        errors(apply(doc, { type: "schedule-burn", bodyId: "sun", t: 0, dv })),
        ['bodyId: "sun" has no orbit to burn on.'],
    );
});

Deno.test("schedule-burn with a missing parent is an error", () => {
    const orphaned: Document = {
        ...doc,
        scenario: {
            ...solarSystem,
            bodies: [
                ...solarSystem.bodies,
                { ...probe, orbit: { parent: "nowhere", elements } },
            ],
        },
    };

    assertEquals(
        errors(
            apply(orphaned, {
                type: "schedule-burn",
                bodyId: "probe",
                t: 0,
                dv: { prograde: 1, normal: 0, radial: 0 },
            }),
        ),
        ['bodyId: there is no body "nowhere"'],
    );
});

Deno.test("load replaces the document", () => {
    const other = builtInScenarios.find((scenario) => scenario !== solarSystem);
    assert(other);

    const next = ok(apply(doc, { type: "load", doc: documentOf(other) }));

    assertEquals(next.scenario, other);
    assertEquals(next.timeline, []);
});

Deno.test("load with an invalid scenario returns errors", () => {
    const bad = documentOf({ ...solarSystem, name: "", bodies: [] });

    assert(errors(apply(doc, { type: "load", doc: bad })).length > 0);
});

Deno.test("apply doesn't change its input", () => {
    const before = structuredClone(doc);
    const dv = { prograde: 10, normal: 0, radial: 0 };
    const commands: Command[] = [
        { type: "add-body", body: probe },
        { type: "remove-body", id: "earth" },
        { type: "update-body", id: "earth", patch: { name: "Terra" } },
        { type: "set-orbit", bodyId: "iss", t: 0, elements },
        { type: "schedule-burn", bodyId: "earth", t: 0, dv },
        { type: "load", doc: documentOf(solarSystem) },
        { type: "remove-body", id: "sun" },
    ];

    for (const cmd of commands) {
        apply(doc, cmd);
        assertEquals(doc, before);
    }
});

Deno.test("a successful result is a new document", () => {
    const next = ok(
        apply(doc, { type: "update-body", id: "earth", patch: {} }),
    );

    assert(next !== doc);
    assert(next.scenario.bodies !== doc.scenario.bodies);
});

Deno.test("schedule-burn on a j2 body burns the elements as precessed", () => {
    const earth = orbiting("earth");
    const gravity = PRESETS.earth?.gravity;
    const axes = bodyOrientation(PRESETS.earth?.rotation, elements.epoch);
    assert(gravity && axes);

    const body: Body = {
        ...probe,
        perturbations: [{ type: "j2" }],
    };
    const withBody = ok(apply(doc, { type: "add-body", body }));
    const t = 1e8;
    const dv = { prograde: 10, normal: 0, radial: 0 };
    const rates = j2Precession(
        elements,
        earth.mass.mu,
        gravity.j2,
        gravity.radius,
        axes.z,
    );
    const precessed = elementsAt(elements, [rates], t);
    const direct = applyBurn(precessed, earth.mass.mu, t, dv);
    assert(direct.ok);
    assert(precessed.raan !== elements.raan);

    const next = ok(
        apply(withBody, { type: "schedule-burn", bodyId: "probe", t, dv }),
    );

    assertEquals(find(next, "probe")?.orbit?.elements, direct.elements);
});
