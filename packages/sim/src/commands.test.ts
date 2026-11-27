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
import { compile } from "./snapshot.ts";

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

Deno.test("set-orbit appends an event and leaves the scenario alone", () => {
    const next = ok(
        apply(doc, { type: "set-orbit", bodyId: "earth", t: 5, elements }),
    );

    assertEquals(next.scenario, doc.scenario);
    assertEquals(next.timeline, [
        { type: "set-orbit", id: "e1", bodyId: "earth", t: 5, elements },
    ]);
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

Deno.test("schedule-burn appends an event whose orbit is the one applyBurn gives", () => {
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

    assertEquals(next.scenario, doc.scenario);
    assertEquals(next.timeline, [
        { type: "burn", id: "e1", bodyId: "earth", t, dv },
    ]);
    assertEquals(
        compile(next, PRESETS).elementsAt("earth", t),
        direct.elements,
    );
});

Deno.test("a burn changes the orbit from its time on, and not before", () => {
    const dv = { prograde: 100, normal: 0, radial: 0 };
    const t = 1e7;
    const next = ok(
        apply(doc, { type: "schedule-burn", bodyId: "earth", t, dv }),
    );
    const before = compile(doc, PRESETS);
    const after = compile(next, PRESETS);

    assertEquals(
        after.elementsAt("earth", t - 1),
        before.elementsAt("earth", t - 1),
    );
    assertEquals(after.elementsAt("earth", 0), before.elementsAt("earth", 0));
    assert(after.elementsAt("earth", t).a !== before.elementsAt("earth", t).a);
});

Deno.test("a burn and a set-orbit keep the perturbations", () => {
    const precessing = solarSystem.bodies.find(
        (body) => body.orbit !== undefined && body.perturbations !== undefined,
    );
    assert(precessing);

    const burned = ok(
        apply(doc, {
            type: "schedule-burn",
            bodyId: precessing.id,
            t: 0,
            dv: { prograde: 1, normal: 0, radial: 0 },
        }),
    );
    const set = ok(
        apply(doc, {
            type: "set-orbit",
            bodyId: precessing.id,
            t: 0,
            elements: orbiting(precessing.id).orbit.elements,
        }),
    );

    for (const next of [burned, set]) {
        assertEquals(find(next, precessing.id), precessing);
        assertEquals(
            compile(next, PRESETS).segmentAt(precessing.id, 1).precessions
                .length,
            precessing.perturbations?.length,
        );
    }
});

Deno.test("event ids are e<n> with n one more than the largest", () => {
    const dv = { prograde: 1, normal: 0, radial: 0 };
    const first = ok(
        apply(doc, { type: "schedule-burn", bodyId: "earth", t: 0, dv }),
    );
    const second = ok(
        apply(first, { type: "set-orbit", bodyId: "iss", t: 1, elements }),
    );
    const loaded: Document = {
        ...second,
        timeline: second.timeline.map((event) => ({
            ...event,
            id: event.id === "e1" ? "e7" : "x",
        })),
    };
    const third = ok(
        apply(loaded, { type: "schedule-burn", bodyId: "earth", t: 2, dv }),
    );

    assertEquals(
        second.timeline.map((event) => event.id),
        ["e1", "e2"],
    );
    assertEquals(third.timeline.at(-1)?.id, "e8");
});

Deno.test("remove-event takes the event out and the orbit goes back", () => {
    const dv = { prograde: 100, normal: 0, radial: 0 };
    const burned = ok(
        apply(doc, { type: "schedule-burn", bodyId: "earth", t: 1e7, dv }),
    );
    const next = ok(apply(burned, { type: "remove-event", id: "e1" }));

    assertEquals(next.timeline, []);
    assertEquals(next.scenario, doc.scenario);
});

Deno.test("remove-event of an unknown id is an error", () => {
    assertEquals(errors(apply(doc, { type: "remove-event", id: "e1" })), [
        'id: there is no event "e1"',
    ]);
});

// Moon around Earth: a 1 km/s burn escapes from its own orbit but not from a low circular one.
const lowOrbit: Elements = { ...elements, a: 1e7, e: 0, i: 0, epoch: 0 };
const lift = { prograde: 1e3, normal: 0, radial: 0 };
const lowThenBurn: Document = {
    ...doc,
    timeline: [
        {
            type: "set-orbit",
            id: "e1",
            bodyId: "moon",
            t: 0,
            elements: lowOrbit,
        },
        { type: "burn", id: "e2", bodyId: "moon", t: 10, dv: lift },
    ],
};

Deno.test("remove-event is rejected if a later burn then fails", () => {
    const [error, ...rest] = errors(
        apply(lowThenBurn, { type: "remove-event", id: "e1" }),
    );

    assertEquals(rest, []);
    assert(error?.startsWith('timeline: can\'t burn "moon" at t=10'));
});

Deno.test("a new event is rejected if it makes a later burn fail", () => {
    const moon = orbiting("moon");
    const [error] = errors(
        apply(lowThenBurn, {
            type: "set-orbit",
            bodyId: "moon",
            t: 5,
            elements: moon.orbit.elements,
        }),
    );

    assert(error?.startsWith('timeline: can\'t burn "moon" at t=10'));
});

Deno.test("remove-body drops the events of the removed subtree", () => {
    const dv = { prograde: 1, normal: 0, radial: 0 };
    const withEvents = ok(
        apply(
            ok(
                apply(doc, {
                    type: "schedule-burn",
                    bodyId: "earth",
                    t: 0,
                    dv,
                }),
            ),
            {
                type: "set-orbit",
                bodyId: "mars",
                t: 1,
                elements: orbiting("mars").orbit.elements,
            },
        ),
    );
    const withMoonBurn = ok(
        apply(withEvents, { type: "schedule-burn", bodyId: "iss", t: 2, dv }),
    );
    const next = ok(apply(withMoonBurn, { type: "remove-body", id: "earth" }));

    assertEquals(
        next.timeline.map((event) => event.bodyId),
        ["mars"],
    );
});

Deno.test("load validates the timeline", () => {
    const bad = {
        ...doc,
        timeline: [{ type: "burn", id: "e1", bodyId: "sun", t: 0, dv: {} }],
    } as unknown as Document;
    const messages = errors(apply(doc, { type: "load", doc: bad }));

    assert(
        messages.some((message) => message.startsWith("timeline[0].bodyId")),
    );
    assert(
        messages.some((message) =>
            message.startsWith("timeline[0].dv.prograde"),
        ),
    );
});

Deno.test("load keeps a valid timeline", () => {
    const dv = { prograde: 1, normal: 0, radial: 0 };
    const withEvent = ok(
        apply(doc, { type: "schedule-burn", bodyId: "earth", t: 0, dv }),
    );

    assertEquals(ok(apply(doc, { type: "load", doc: withEvent })), withEvent);
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

    assertEquals(
        compile(next, PRESETS).elementsAt("probe", t),
        direct.elements,
    );
});
