/// <reference types="deno" />
import { type Body, solarSystem } from "@cpluspatch/orbit";
import {
    assert,
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
    const next = {
        ...solarSystem,
        name: "Next",
        bodies: solarSystem.bodies.filter((body) => body.id !== "mars"),
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

Deno.test("adding a body emits one scenario event and keeps focus and selection", () => {
    const world = make();
    world.focus("earth");
    world.select("mars");
    const events: WorldEvent[] = [];
    world.on((e) => events.push(e));

    world.addBody(rock("rock", "moon"));

    assertEquals(events, [{ type: "scenario" }]);
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

Deno.test("removing a body removes the bodies that orbit it, in one event", () => {
    const world = make();
    const events: WorldEvent[] = [];
    world.on((e) => events.push(e));

    world.removeBody("earth");

    const ids = world.scenario.bodies.map((body) => body.id);
    assertEquals(events, [{ type: "scenario" }]);
    assert(!ids.includes("earth"));
    assert(!ids.includes("moon"));
    assert(!ids.includes("iss"));
    assert(ids.includes("mars"));
    assertEquals(world.order.length, ids.length);
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
