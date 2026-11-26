/// <reference types="deno" />

import { PRESETS, solarSystem } from "@cpluspatch/catalog";
import { stateAt } from "@cpluspatch/orbit";
import {
    assert,
    assertEquals,
    assertStrictEquals,
    assertThrows,
} from "@std/assert";
import { precessionsOf } from "../perturb/index.ts";
import { elementsAt } from "../precession.ts";
import { expandPresets } from "../presets.ts";
import type { Body } from "../scenario.ts";
import { isOrbiting, sortByDepth } from "../scenario.ts";
import { analytic } from "./analytic.ts";
import type { Propagator, Track } from "./index.ts";
import { PROPAGATORS, prepareTrack, tracksByBody } from "./index.ts";

const order = sortByDepth(expandPresets(solarSystem, PRESETS)).map(
    (body): Body =>
        body.id === "moon"
            ? {
                  ...body,
                  perturbations: [
                      {
                          type: "secular",
                          pole: { x: 0, y: 0, z: 1 },
                          nodeRate: -1e-6,
                          argpRate: 1e-6,
                      },
                  ],
              }
            : body,
);

const moon = order.find((body) => body.id === "moon");
const earth = order.find((body) => body.id === "earth");

assert(moon && isOrbiting(moon) && earth);

const track = (id: string): Track => {
    const track = tracksByBody(order).get(id);

    assert(track, `no track for ${id}`);

    return track;
};

// The state's x tells the stubs apart.
const stub = (name: string, supported: boolean, x = 0): Propagator => ({
    name,
    supports: () => supported,
    prepare: () => ({
        stateAt: () => ({ r: { x, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 } }),
    }),
});

Deno.test("the analytic track of a perturbed body equals its precessed Kepler state exactly", () => {
    const precessions = precessionsOf(moon, earth);

    assert(precessions.length > 0);

    for (const t of [0, 7.5e8, -3.15576e9, 123_456_789.5]) {
        assertEquals(
            track("moon").stateAt(t),
            stateAt(
                elementsAt(moon.orbit.elements, precessions, t),
                earth.mass.mu + moon.mass.mu,
                t,
            ),
        );
    }
});

Deno.test("tracks cover every orbiting body and not the root", () => {
    const tracks = tracksByBody(order);

    assertEquals(tracks.size, order.length - 1);
    assertEquals(tracks.has("sun"), false);
});

Deno.test("prepareTrack throws when no propagator supports the body", () => {
    assertThrows(
        () => prepareTrack(moon, earth, [], [stub("never", false)]),
        Error,
        "No propagator supports moon",
    );
    assertThrows(
        () => prepareTrack(moon, earth, [], []),
        Error,
        "No propagator supports moon",
    );
});

Deno.test("prepareTrack uses the first propagator that supports the body", () => {
    const first = stub("first", true, 1);
    const second = stub("second", true, 2);
    const skipped = stub("skipped", false);
    const expected = first.prepare(moon, earth, []).stateAt(0);

    assertEquals(
        prepareTrack(moon, earth, [], [skipped, first, second]).stateAt(0),
        expected,
    );
    assertEquals(
        prepareTrack(moon, earth, [], [skipped, second, first]).stateAt(0),
        second.prepare(moon, earth, []).stateAt(0),
    );
});

Deno.test("the default propagators are the analytic one", () => {
    assertEquals(PROPAGATORS.length, 1);
    assertStrictEquals(PROPAGATORS[0], analytic);
    assertEquals(analytic.supports(moon, earth), true);
});
