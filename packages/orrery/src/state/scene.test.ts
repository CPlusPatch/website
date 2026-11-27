/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/catalog";
import { stateAt } from "@cpluspatch/orbit";
import { Clock, type SceneEvent } from "@cpluspatch/render";
import { type Body, documentOf, subtreeIds } from "@cpluspatch/sim";
import {
    assert,
    assertAlmostEquals,
    assertEquals,
    assertNotEquals,
    assertThrows,
} from "@std/assert";
import { newBody } from "../adding.ts";
import { type Held, Scene } from "./scene.ts";

const make = (): Scene => new Scene(solarSystem, new Clock(0, 1, false));

Deno.test("a scene writes through the object its hold function returns", () => {
    const held: Held = {
        doc: documentOf(solarSystem),
        focused: "",
        selected: null,
        loads: 0,
    };
    const scene = new Scene(solarSystem, new Clock(0, 1, false), (initial) =>
        Object.assign(held, initial),
    );

    scene.select("earth");
    scene.focus("moon");

    assertEquals(held.selected, "earth");
    assertEquals(held.focused, "moon");
    assertEquals(held.loads, 0);

    scene.load(solarSystem, 0);

    assertEquals(held.loads, 1);
    assertEquals(scene.loads, 1);
    assertEquals(held.selected, null);
    assert(held.doc === scene.doc);
});

Deno.test("the scene starts focused on the root", () => {
    const scene = make();

    assertEquals(scene.focused, "sun");
});

Deno.test("each mutation emits exactly one event", () => {
    const scene = make();
    const events: SceneEvent[] = [];
    scene.on((e) => events.push(e));

    scene.focus("earth");
    scene.setClock({ t: 10, rate: 60, paused: true });

    assertEquals(events, [{ type: "focus", id: "earth" }, { type: "clock" }]);
    assertEquals(scene.focused, "earth");
    assertEquals(scene.clock.t, 10);
    assertEquals(scene.clock.rate, 60);
    assertEquals(scene.clock.paused, true);
});

Deno.test("ticking the clock emits nothing", () => {
    const scene = make();
    let count = 0;
    scene.on(() => count++);

    scene.clock.tick(1);

    assertEquals(count, 0);
});

Deno.test("an unsubscribed listener hears nothing more", () => {
    const scene = make();
    let count = 0;
    const off = scene.on(() => count++);

    scene.setClock({ paused: true });
    off();
    scene.setClock({ paused: false });

    assertEquals(count, 1);
});

Deno.test("a listener that throws doesn't stop the next one, and the emit rethrows", () => {
    const scene = make();
    const heard: string[] = [];
    const off = scene.on(() => {
        throw new Error("first");
    });
    scene.on((e) => heard.push(e.type));

    assertThrows(() => scene.setClock({ paused: true }), Error, "first");
    assertEquals(heard, ["clock"]);

    off();
    scene.on(() => {
        throw new Error("one");
    });
    scene.on(() => {
        throw new Error("two");
    });

    assertThrows(() => scene.setClock({ paused: false }), AggregateError);
    assertEquals(heard, ["clock", "clock"]);
});

Deno.test("states returns the same map until the time changes", () => {
    const scene = make();

    const first = scene.states();
    const again = scene.states();
    scene.clock.tick(100);
    const later = scene.states();

    assert(first === again);
    assertNotEquals(first, later);
    assert(later === scene.states());
});

Deno.test("focusing an unknown body throws and changes nothing", () => {
    const scene = make();
    let count = 0;
    scene.on(() => count++);

    assertThrows(() => scene.focus("nowhere"));

    assertEquals(scene.focused, "sun");
    assertEquals(count, 0);
});

Deno.test("nothing is selected at first", () => {
    assertEquals(make().selected, null);
});

Deno.test("selecting a body emits one event, and null clears it", () => {
    const scene = make();
    const events: SceneEvent[] = [];
    scene.on((e) => events.push(e));

    scene.select("moon");
    scene.select(null);

    assertEquals(events, [
        { type: "selection", id: "moon" },
        { type: "selection", id: null },
    ]);
    assertEquals(scene.selected, null);
});

Deno.test("selecting an unknown body throws and changes nothing", () => {
    const scene = make();
    scene.select("earth");
    let count = 0;
    scene.on(() => count++);

    assertThrows(() => scene.select("nowhere"));

    assertEquals(scene.selected, "earth");
    assertEquals(count, 0);
});

Deno.test("setElements emits one body event and the states follow the new orbit", () => {
    const scene = make();
    const moon = scene.scenario.bodies.find((body) => body.id === "moon");
    const before = scene.states().get("moon");
    const events: SceneEvent[] = [];
    scene.on((e) => events.push(e));

    if (!moon?.orbit) throw new Error("The scenario has no Moon.");
    scene.setElements("moon", {
        ...moon.orbit.elements,
        a: moon.orbit.elements.a * 2,
    });

    assertEquals(events, [{ type: "body", id: "moon" }]);
    assertEquals(
        scene.system.elementsAt("moon", scene.clock.t).a,
        moon.orbit.elements.a * 2,
    );
    assertNotEquals(scene.states().get("moon"), before);
});

Deno.test("setElements throws for an unknown body or one with no parent", () => {
    const scene = make();
    const earth = scene.scenario.bodies.find((body) => body.id === "earth");
    const el = earth?.orbit?.elements;
    if (!el) throw new Error("The scenario has no Earth.");
    let count = 0;
    scene.on(() => count++);

    assertThrows(() => scene.setElements("nowhere", el));
    assertThrows(() => scene.setElements("sun", el));

    assertEquals(count, 0);
});

const PROGRADE = { prograde: 100, normal: 0, radial: 0 };

Deno.test("a burn emits one body event and changes the orbit from now on", () => {
    const scene = make();
    const before = scene.scenario;
    const orbitBefore = scene.system.elementsAt("moon", scene.clock.t);
    const events: SceneEvent[] = [];
    scene.on((e) => events.push(e));

    const result = scene.burn("moon", PROGRADE);

    assertEquals(result, { ok: true });
    assertEquals(events, [{ type: "body", id: "moon" }]);
    assert(scene.scenario === before);
    assertEquals(scene.doc.timeline.length, 1);
    assertNotEquals(
        scene.system.elementsAt("moon", scene.clock.t),
        orbitBefore,
    );
    assertEquals(
        scene.system.segmentAt("moon", scene.clock.t).elements.epoch,
        scene.clock.t,
    );
    assertEquals(
        scene.system.elementsAt("moon", scene.clock.t - 1).a,
        orbitBefore.a,
    );
});

Deno.test("a burn that escapes returns why and emits nothing", () => {
    const scene = make();
    const before = scene.scenario;
    let count = 0;
    scene.on(() => count++);

    const result = scene.burn("moon", { prograde: 1e6, normal: 0, radial: 0 });

    assertEquals(result, { ok: false, reason: "escape" });
    assert(scene.scenario === before);
    assertEquals(count, 0);
});

Deno.test("previewBurn returns the new orbit without changing the scenario", () => {
    const scene = make();
    const before = scene.scenario;
    let count = 0;
    scene.on(() => count++);

    const result = scene.previewBurn("moon", PROGRADE);

    assert(result.ok);
    assert(scene.scenario === before);
    assertEquals(count, 0);
});

Deno.test("dispatch applies a command and emits one body event", () => {
    const scene = make();
    const events: SceneEvent[] = [];
    scene.on((e) => events.push(e));

    const result = scene.dispatch({
        type: "schedule-burn",
        bodyId: "moon",
        t: 0,
        dv: PROGRADE,
    });

    assertEquals(result, { ok: true });
    assertEquals(events, [{ type: "body", id: "moon" }]);
});

Deno.test("dispatch reports a rejected command and changes nothing", () => {
    const scene = make();
    const before = scene.doc;
    let count = 0;
    scene.on(() => count++);

    const result = scene.dispatch({
        type: "schedule-burn",
        bodyId: "nowhere",
        t: 0,
        dv: PROGRADE,
    });

    assert(!result.ok);
    assert(result.errors.length > 0);
    assert(scene.doc === before);
    assertEquals(count, 0);
});

Deno.test("dispatch of remove-body removes the subtree and moves the focus and selection", () => {
    const scene = make();
    scene.focus("moon");
    scene.select("moon");
    const events: SceneEvent[] = [];
    scene.on((e) => events.push(e));

    const result = scene.dispatch({ type: "remove-body", id: "earth" });

    assertEquals(result, { ok: true });
    assert(!scene.scenario.bodies.some((body) => body.id === "moon"));
    assertEquals(scene.focused, "sun");
    assertEquals(scene.selected, null);
    assertEquals(
        events.map((e) => e.type),
        ["bodies", "focus", "selection"],
    );
});

Deno.test("dispatch of remove-body reports the root or an unknown body and emits nothing", () => {
    const scene = make();
    const before = scene.doc;
    let count = 0;
    scene.on(() => count++);

    for (const id of ["sun", "nowhere"]) {
        const result = scene.dispatch({ type: "remove-body", id });

        assert(!result.ok);
        assert(result.errors.length > 0);
    }

    assert(scene.doc === before);
    assertEquals(count, 0);
});

Deno.test("burning a body with no orbit throws", () => {
    const scene = make();

    assertThrows(() => scene.burn("sun", PROGRADE));
    assertThrows(() => scene.previewBurn("nowhere", PROGRADE));
});

Deno.test("loading a scenario resets the selection and focus, and sets the clock", () => {
    const scene = make();
    scene.select("mars");
    scene.focus("earth");
    const events: SceneEvent[] = [];
    scene.on((e) => events.push(e));
    const gone = new Set(subtreeIds(solarSystem, "mars"));
    const next = {
        ...solarSystem,
        name: "Next",
        bodies: solarSystem.bodies.filter((body) => !gone.has(body.id)),
    };

    scene.load(next, 500);

    assertEquals(events, [{ type: "scenario" }]);
    assertEquals(scene.scenario, next);
    assertEquals(
        scene.order.some((body) => body.id === "mars"),
        false,
    );
    assertEquals(scene.selected, null);
    assertEquals(scene.focused, "sun");
    assertEquals(scene.clock.t, 500);
    assertEquals(scene.states().has("mars"), false);
});

const rock = (id: string, parent: string): Body => {
    const body = solarSystem.bodies.find(
        (candidate) => candidate.id === "moon",
    );
    if (!body?.orbit) throw new Error("The scenario has no Moon.");

    return { ...body, id, name: id, orbit: { ...body.orbit, parent } };
};

Deno.test("adding a body emits one bodies event and keeps focus and selection", () => {
    const scene = make();
    scene.focus("earth");
    scene.select("mars");
    const events: SceneEvent[] = [];
    scene.on((e) => events.push(e));

    scene.addBody(rock("rock", "moon"));

    assertEquals(events, [{ type: "bodies", added: ["rock"], removed: [] }]);
    assert(scene.scenario.bodies.some((body) => body.id === "rock"));
    assertEquals(scene.order.at(-1)?.id, "rock");
    assert(scene.states().has("rock"));
    assertEquals(scene.focused, "earth");
    assertEquals(scene.selected, "mars");
});

Deno.test("adding a body with a bad parent or a taken id throws and emits nothing", () => {
    const scene = make();
    const before = scene.scenario;
    let count = 0;
    scene.on(() => count++);

    assertThrows(() => scene.addBody(rock("rock", "nowhere")));
    assertThrows(() => scene.addBody(rock("moon", "earth")));

    assert(scene.scenario === before);
    assertEquals(count, 0);
});

Deno.test("dispatch of add-body emits one bodies event, and a bad parent emits nothing", () => {
    const scene = make();
    const events: SceneEvent[] = [];
    scene.on((e) => events.push(e));

    const added = scene.dispatch({
        type: "add-body",
        body: rock("rock", "moon"),
    });

    assertEquals(added, { ok: true });
    assertEquals(events, [{ type: "bodies", added: ["rock"], removed: [] }]);

    const before = scene.doc;
    const bad = scene.dispatch({
        type: "add-body",
        body: rock("rock2", "nowhere"),
    });

    assert(!bad.ok);
    assert(scene.doc === before);
    assertEquals(events.length, 1);
});

Deno.test("adding a body made by newBody works", () => {
    const scene = make();
    const earth = scene.scenario.bodies.find((body) => body.id === "earth");
    if (!earth) throw new Error("The scenario has no Earth.");

    scene.addBody(
        newBody(
            {
                id: "probe",
                name: "Probe",
                tag: "spacecraft",
                parent: earth,
                radiusKm: 1,
                massKg: 0,
                aKm: 20000,
                e: 0,
                iDeg: 0,
            },
            scene.clock.t,
        ),
    );

    assert(scene.scenario.bodies.some((body) => body.id === "probe"));
});

Deno.test("removing a body removes the bodies that orbit it, in one bodies event", () => {
    const scene = make();
    const events: SceneEvent[] = [];
    scene.on((e) => events.push(e));

    scene.removeBody("earth");

    const ids = scene.scenario.bodies.map((body) => body.id);
    assertEquals(events, [
        {
            type: "bodies",
            added: [],
            removed: subtreeIds(solarSystem, "earth"),
        },
    ]);
    assert(subtreeIds(solarSystem, "earth").length > 1);
    assert(!ids.includes("earth"));
    assert(!ids.includes("moon"));
    assert(!ids.includes("iss"));
    assert(ids.includes("mars"));
    assertEquals(scene.order.length, ids.length);
});

Deno.test("removing a body emits focus and selection after bodies, with the state already set", () => {
    const scene = make();
    scene.focus("moon");
    scene.select("iss");
    const seen: string[] = [];
    scene.on((e) => {
        seen.push(
            `${e.type}:${scene.focused}:${scene.selected}:${scene.scenario.bodies.length}`,
        );
    });
    const count =
        solarSystem.bodies.length - subtreeIds(solarSystem, "earth").length;

    scene.removeBody("earth");

    assertEquals(seen, [
        `bodies:sun:null:${count}`,
        `focus:sun:null:${count}`,
        `selection:sun:null:${count}`,
    ]);
});

Deno.test("removing a body emits no focus or selection when neither was inside it", () => {
    const scene = make();
    scene.focus("mars");
    scene.select("mars");
    const types: string[] = [];
    scene.on((e) => types.push(e.type));

    scene.removeBody("earth");

    assertEquals(types, ["bodies"]);
});

Deno.test("removing a body emits focus but not selection when only the focus was inside", () => {
    const scene = make();
    scene.focus("moon");
    scene.select("mars");
    const events: SceneEvent[] = [];
    scene.on((e) => events.push(e));

    scene.removeBody("earth");

    assertEquals(
        events.map((e) => e.type),
        ["bodies", "focus"],
    );
    assertEquals(events[1], { type: "focus", id: "sun" });
});

Deno.test("removing the focused body's ancestor moves the focus to its parent", () => {
    const scene = make();
    scene.focus("moon");

    scene.removeBody("earth");

    assertEquals(scene.focused, "sun");
});

Deno.test("removing another body leaves the focus alone", () => {
    const scene = make();
    scene.focus("mars");

    scene.removeBody("earth");

    assertEquals(scene.focused, "mars");
});

Deno.test("removing the selected body or one above it clears the selection", () => {
    const scene = make();
    scene.select("moon");
    scene.removeBody("moon");
    assertEquals(scene.selected, null);

    scene.select("iss");
    scene.removeBody("earth");
    assertEquals(scene.selected, null);
});

Deno.test("removing another body keeps the selection", () => {
    const scene = make();
    scene.select("mars");

    scene.removeBody("earth");

    assertEquals(scene.selected, "mars");
});

Deno.test("removing the focus still announces the new focus and selection when a listener throws", () => {
    const scene = make();
    scene.focus("earth");
    scene.select("moon");
    const types: string[] = [];
    scene.on((event) => {
        if (event.type === "bodies") throw new Error("draw failed");
    });
    scene.on((event) => types.push(event.type));

    assertThrows(() => scene.removeBody("earth"));

    assertEquals(types, ["bodies", "focus", "selection"]);
});

Deno.test("removing the focus doesn't move it to the parent after a listener restores it", () => {
    const scene = make();
    scene.focus("earth");
    const focused: string[] = [];
    let restored = false;
    scene.on((event) => {
        if (event.type === "bodies" && !restored) {
            restored = true;
            scene.load(solarSystem, 0);
            scene.focus("earth");
        }
        if (event.type === "focus") focused.push(event.id);
    });

    scene.removeBody("earth");

    assertEquals(scene.focused, "earth");
    assertEquals(focused, ["earth"]);
});

Deno.test("removing the root or an unknown body throws and emits nothing", () => {
    const scene = make();
    const before = scene.scenario;
    let count = 0;
    scene.on(() => count++);

    assertThrows(() => scene.removeBody("sun"));
    assertThrows(() => scene.removeBody("nowhere"));

    assert(scene.scenario === before);
    assertEquals(count, 0);
});

/** A scene whose Moon precesses about the ecliptic pole. */
const makePrecessing = (): Scene => {
    const bodies = solarSystem.bodies.map((body) =>
        body.id === "moon" && body.orbit !== undefined
            ? {
                  ...body,
                  perturbations: [
                      {
                          type: "secular" as const,
                          pole: { x: 0, y: 0, z: 1 },
                          nodeRate: -1e-6,
                          argpRate: 1e-6,
                      },
                  ],
              }
            : body,
    );

    return new Scene({ ...solarSystem, bodies }, new Clock(1e7, 1, false));
};

Deno.test("setElements keeps a precessing body precessing", () => {
    const scene = makePrecessing();
    const moon = scene.scenario.bodies.find((body) => body.id === "moon");

    if (!moon?.orbit) throw new Error("The scenario has no Moon.");
    assert(moon.perturbations);

    scene.setElements("moon", moon.orbit.elements);

    const after = scene.scenario.bodies.find((body) => body.id === "moon");
    const { precessions } = scene.system.segmentAt("moon", scene.clock.t);
    assertEquals(after?.perturbations, moon.perturbations);
    assertEquals(precessions.length, moon.perturbations.length);
});

Deno.test("a zero burn on a precessing body keeps its position", () => {
    const scene = makePrecessing();
    const t = scene.clock.t;
    const before = scene.states().get("moon");
    const earth = scene.scenario.bodies.find((body) => body.id === "earth");
    const moon = scene.scenario.bodies.find((body) => body.id === "moon");

    assert(before && earth && moon);

    const result = scene.burn("moon", { prograde: 0, normal: 0, radial: 0 });
    assert(result.ok);

    const fixed = scene.system.segmentAt("moon", t);

    const local = stateAt(fixed.elements, earth.mass.mu + moon.mass.mu, t);
    const parent = scene.states().get("earth");
    assert(parent);

    assertEquals(fixed.elements.epoch, t);
    assertAlmostEquals(parent.r.x + local.r.x, before.r.x, 1e-3);
    assertAlmostEquals(parent.r.y + local.r.y, before.r.y, 1e-3);
    assertAlmostEquals(parent.r.z + local.r.z, before.r.z, 1e-3);
});
