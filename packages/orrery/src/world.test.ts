/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/orbit";
import {
    assert,
    assertEquals,
    assertNotEquals,
    assertThrows,
} from "@std/assert";
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
