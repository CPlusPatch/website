/// <reference types="deno" />
import {
    type Body,
    elementsAt,
    solarSystem,
    stateAt,
    subtreeIds,
} from "@cpluspatch/orbit";
import {
    assert,
    assertAlmostEquals,
    assertEquals,
    assertNotEquals,
    assertThrows,
} from "@std/assert";
import { newBody } from "./adding.ts";
import { Clock } from "./clock.ts";
import { World, type WorldEvent } from "./world.ts";

const make = (): World => new World(solarSystem, new Clock(0, 1, false));

Deno.test("the world starts focused on the root", () => {
    const world = make();

    assertEquals(world.focused, "sun");
});

Deno.test("each mutation emits exactly one event", () => {
    const world = make();
    const events: WorldEvent[] = [];
    world.on((e) => events.push(e));

    world.focus("earth");
    world.setClock({ t: 10, rate: 60, paused: true });

    assertEquals(events, [{ type: "focus", id: "earth" }, { type: "clock" }]);
    assertEquals(world.focused, "earth");
    assertEquals(world.clock.t, 10);
    assertEquals(world.clock.rate, 60);
    assertEquals(world.clock.paused, true);
});

Deno.test("ticking the clock emits nothing", () => {
    const world = make();
    let count = 0;
    world.on(() => count++);

    world.clock.tick(1);

    assertEquals(count, 0);
});

Deno.test("an unsubscribed listener hears nothing more", () => {
    const world = make();
    let count = 0;
    const off = world.on(() => count++);

    world.setClock({ paused: true });
    off();
    world.setClock({ paused: false });

    assertEquals(count, 1);
});

Deno.test("a listener that throws doesn't stop the next one, and the emit rethrows", () => {
    const world = make();
    const heard: string[] = [];
    const off = world.on(() => {
        throw new Error("first");
    });
    world.on((e) => heard.push(e.type));

    assertThrows(() => world.setClock({ paused: true }), Error, "first");
    assertEquals(heard, ["clock"]);

    off();
    world.on(() => {
        throw new Error("one");
    });
    world.on(() => {
        throw new Error("two");
    });

    assertThrows(() => world.setClock({ paused: false }), AggregateError);
    assertEquals(heard, ["clock", "clock"]);
});

Deno.test("states returns the same map until the time changes", () => {
    const world = make();

    const first = world.states();
    const again = world.states();
    world.clock.tick(100);
    const later = world.states();

    assert(first === again);
    assertNotEquals(first, later);
    assert(later === world.states());
});

Deno.test("focusing an unknown body throws and changes nothing", () => {
    const world = make();
    let count = 0;
    world.on(() => count++);

    assertThrows(() => world.focus("nowhere"));

    assertEquals(world.focused, "sun");
    assertEquals(count, 0);
});

Deno.test("nothing is selected at first", () => {
    assertEquals(make().selected, null);
});

Deno.test("selecting a body emits one event, and null clears it", () => {
    const world = make();
    const events: WorldEvent[] = [];
    world.on((e) => events.push(e));

    world.select("moon");
    world.select(null);

    assertEquals(events, [
        { type: "selection", id: "moon" },
        { type: "selection", id: null },
    ]);
    assertEquals(world.selected, null);
});

Deno.test("selecting an unknown body throws and changes nothing", () => {
    const world = make();
    world.select("earth");
    let count = 0;
    world.on(() => count++);

    assertThrows(() => world.select("nowhere"));

    assertEquals(world.selected, "earth");
    assertEquals(count, 0);
});

Deno.test("setElements emits one body event and the states follow the new orbit", () => {
    const world = make();
    const moon = world.scenario.bodies.find((body) => body.id === "moon");
    const before = world.states().get("moon");
    const events: WorldEvent[] = [];
    world.on((e) => events.push(e));

    if (!moon?.elements) throw new Error("The scenario has no Moon.");
    world.setElements("moon", { ...moon.elements, a: moon.elements.a * 2 });

    assertEquals(events, [{ type: "body", id: "moon" }]);
    assertEquals(
        world.scenario.bodies.find((body) => body.id === "moon")?.elements?.a,
        moon.elements.a * 2,
    );
    assertEquals(
        world.order.find((body) => body.id === "moon")?.elements?.a,
        moon.elements.a * 2,
    );
    assertNotEquals(world.states().get("moon"), before);
});

Deno.test("setElements throws for an unknown body or one with no parent", () => {
    const world = make();
    const earth = world.scenario.bodies.find((body) => body.id === "earth");
    const el = earth?.elements;
    if (!el) throw new Error("The scenario has no Earth.");
    let count = 0;
    world.on(() => count++);

    assertThrows(() => world.setElements("nowhere", el));
    assertThrows(() => world.setElements("sun", el));

    assertEquals(count, 0);
});

const PROGRADE = { prograde: 100, normal: 0, radial: 0 };

Deno.test("a burn emits one body event and changes the orbit", () => {
    const world = make();
    const before = world.scenario.bodies.find((body) => body.id === "moon");
    const events: WorldEvent[] = [];
    world.on((e) => events.push(e));

    const result = world.burn("moon", PROGRADE);

    const after = world.scenario.bodies.find((body) => body.id === "moon");
    assertEquals(result, { ok: true });
    assertEquals(events, [{ type: "body", id: "moon" }]);
    assertNotEquals(after?.elements, before?.elements);
    assertEquals(after?.elements?.epoch, world.clock.t);
});

Deno.test("a burn that escapes returns why and emits nothing", () => {
    const world = make();
    const before = world.scenario;
    let count = 0;
    world.on(() => count++);

    const result = world.burn("moon", { prograde: 1e6, normal: 0, radial: 0 });

    assertEquals(result, { ok: false, reason: "escape" });
    assert(world.scenario === before);
    assertEquals(count, 0);
});

Deno.test("previewBurn returns the new orbit without changing the scenario", () => {
    const world = make();
    const before = world.scenario;
    let count = 0;
    world.on(() => count++);

    const result = world.previewBurn("moon", PROGRADE);

    assert(result.ok);
    assert(world.scenario === before);
    assertEquals(count, 0);
});

Deno.test("burning a body with no orbit throws", () => {
    const world = make();

    assertThrows(() => world.burn("sun", PROGRADE));
    assertThrows(() => world.previewBurn("nowhere", PROGRADE));
});

Deno.test("loading a scenario resets the selection and focus, and sets the clock", () => {
    const world = make();
    world.select("mars");
    world.focus("earth");
    const events: WorldEvent[] = [];
    world.on((e) => events.push(e));
    const gone = new Set(subtreeIds(solarSystem, "mars"));
    const next = {
        ...solarSystem,
        name: "Next",
        bodies: solarSystem.bodies.filter((body) => !gone.has(body.id)),
    };

    world.load(next, 500);

    assertEquals(events, [{ type: "scenario" }]);
    assertEquals(world.scenario, next);
    assertEquals(
        world.order.some((body) => body.id === "mars"),
        false,
    );
    assertEquals(world.selected, null);
    assertEquals(world.focused, "sun");
    assertEquals(world.clock.t, 500);
    assertEquals(world.states().has("mars"), false);
});

const rock = (id: string, parent: string): Body => {
    const body = solarSystem.bodies.find(
        (candidate) => candidate.id === "moon",
    );
    if (!body?.elements) throw new Error("The scenario has no Moon.");

    return { ...body, id, name: id, parent };
};

Deno.test("adding a body emits one bodies event and keeps focus and selection", () => {
    const world = make();
    world.focus("earth");
    world.select("mars");
    const events: WorldEvent[] = [];
    world.on((e) => events.push(e));

    world.addBody(rock("rock", "moon"));

    assertEquals(events, [{ type: "bodies", added: ["rock"], removed: [] }]);
    assert(world.scenario.bodies.some((body) => body.id === "rock"));
    assertEquals(world.order.at(-1)?.id, "rock");
    assert(world.states().has("rock"));
    assertEquals(world.focused, "earth");
    assertEquals(world.selected, "mars");
});

Deno.test("adding a body with a bad parent or a taken id throws and emits nothing", () => {
    const world = make();
    const before = world.scenario;
    let count = 0;
    world.on(() => count++);

    assertThrows(() => world.addBody(rock("rock", "nowhere")));
    assertThrows(() => world.addBody(rock("moon", "earth")));

    assert(world.scenario === before);
    assertEquals(count, 0);
});

Deno.test("adding a body made by newBody works", () => {
    const world = make();
    const earth = world.scenario.bodies.find((body) => body.id === "earth");
    if (!earth) throw new Error("The scenario has no Earth.");

    world.addBody(
        newBody(
            {
                id: "probe",
                name: "Probe",
                kind: "spacecraft",
                parent: earth,
                radiusKm: 1,
                massKg: 0,
                aKm: 20000,
                e: 0,
                iDeg: 0,
            },
            world.clock.t,
        ),
    );

    assert(world.scenario.bodies.some((body) => body.id === "probe"));
});

Deno.test("removing a body removes the bodies that orbit it, in one bodies event", () => {
    const world = make();
    const events: WorldEvent[] = [];
    world.on((e) => events.push(e));

    world.removeBody("earth");

    const ids = world.scenario.bodies.map((body) => body.id);
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
    assertEquals(world.order.length, ids.length);
});

Deno.test("removing a body emits focus and selection after bodies, with the state already set", () => {
    const world = make();
    world.focus("moon");
    world.select("iss");
    const seen: string[] = [];
    world.on((e) => {
        seen.push(
            `${e.type}:${world.focused}:${world.selected}:${world.scenario.bodies.length}`,
        );
    });
    const count =
        solarSystem.bodies.length - subtreeIds(solarSystem, "earth").length;

    world.removeBody("earth");

    assertEquals(seen, [
        `bodies:sun:null:${count}`,
        `focus:sun:null:${count}`,
        `selection:sun:null:${count}`,
    ]);
});

Deno.test("removing a body emits no focus or selection when neither was inside it", () => {
    const world = make();
    world.focus("mars");
    world.select("mars");
    const types: string[] = [];
    world.on((e) => types.push(e.type));

    world.removeBody("earth");

    assertEquals(types, ["bodies"]);
});

Deno.test("removing a body emits focus but not selection when only the focus was inside", () => {
    const world = make();
    world.focus("moon");
    world.select("mars");
    const events: WorldEvent[] = [];
    world.on((e) => events.push(e));

    world.removeBody("earth");

    assertEquals(
        events.map((e) => e.type),
        ["bodies", "focus"],
    );
    assertEquals(events[1], { type: "focus", id: "sun" });
});

Deno.test("removing the focused body's ancestor moves the focus to its parent", () => {
    const world = make();
    world.focus("moon");

    world.removeBody("earth");

    assertEquals(world.focused, "sun");
});

Deno.test("removing another body leaves the focus alone", () => {
    const world = make();
    world.focus("mars");

    world.removeBody("earth");

    assertEquals(world.focused, "mars");
});

Deno.test("removing the selected body or one above it clears the selection", () => {
    const world = make();
    world.select("moon");
    world.removeBody("moon");
    assertEquals(world.selected, null);

    world.select("iss");
    world.removeBody("earth");
    assertEquals(world.selected, null);
});

Deno.test("removing another body keeps the selection", () => {
    const world = make();
    world.select("mars");

    world.removeBody("earth");

    assertEquals(world.selected, "mars");
});

Deno.test("removing the focus still announces the new focus and selection when a listener throws", () => {
    const world = make();
    world.focus("earth");
    world.select("moon");
    const types: string[] = [];
    world.on((event) => {
        if (event.type === "bodies") throw new Error("draw failed");
    });
    world.on((event) => types.push(event.type));

    assertThrows(() => world.removeBody("earth"));

    assertEquals(types, ["bodies", "focus", "selection"]);
});

Deno.test("removing the focus doesn't move it to the parent after a listener restores it", () => {
    const world = make();
    world.focus("earth");
    const focused: string[] = [];
    let restored = false;
    world.on((event) => {
        if (event.type === "bodies" && !restored) {
            restored = true;
            world.load(solarSystem, 0);
            world.focus("earth");
        }
        if (event.type === "focus") focused.push(event.id);
    });

    world.removeBody("earth");

    assertEquals(world.focused, "earth");
    assertEquals(focused, ["earth"]);
});

Deno.test("removing the root or an unknown body throws and emits nothing", () => {
    const world = make();
    const before = world.scenario;
    let count = 0;
    world.on(() => count++);

    assertThrows(() => world.removeBody("sun"));
    assertThrows(() => world.removeBody("nowhere"));

    assert(world.scenario === before);
    assertEquals(count, 0);
});

/** A world whose Moon precesses about the ecliptic pole. */
const makePrecessing = (): World => {
    const bodies = solarSystem.bodies.map((body) =>
        body.id === "moon" && body.parent !== null
            ? {
                  ...body,
                  precession: {
                      pole: { x: 0, y: 0, z: 1 },
                      nodeRate: -1e-6,
                      argpRate: 1e-6,
                  },
              }
            : body,
    );

    return new World({ ...solarSystem, bodies }, new Clock(1e7, 1, false));
};

Deno.test("setElements turns a precessing body into a fixed orbit", () => {
    const world = makePrecessing();
    const moon = world.scenario.bodies.find((body) => body.id === "moon");

    if (!moon?.elements) throw new Error("The scenario has no Moon.");
    assert(moon.precession);

    world.setElements("moon", moon.elements);

    const after = world.scenario.bodies.find((body) => body.id === "moon");
    assert(after && !("precession" in after));
});

Deno.test("a zero burn on a precessing body keeps its position", () => {
    const world = makePrecessing();
    const t = world.clock.t;
    const before = world.states().get("moon");
    const earth = world.scenario.bodies.find((body) => body.id === "earth");
    const moon = world.scenario.bodies.find((body) => body.id === "moon");

    assert(before && earth && moon);

    const result = world.burn("moon", { prograde: 0, normal: 0, radial: 0 });
    assert(result.ok);

    const fixed = world.scenario.bodies.find((body) => body.id === "moon");
    assert(fixed?.elements);

    const local = stateAt(fixed.elements, earth.mu + moon.mu, t);
    const parent = world.states().get("earth");
    assert(parent);

    assertEquals(elementsAt(fixed, t), fixed.elements);
    assertAlmostEquals(parent.r.x + local.r.x, before.r.x, 1e-3);
    assertAlmostEquals(parent.r.y + local.r.y, before.r.y, 1e-3);
    assertAlmostEquals(parent.r.z + local.r.z, before.r.z, 1e-3);
});
