/// <reference types="deno" />

import { assertEquals, assertStrictEquals } from "@std/assert";
import { expandBody, type Presets } from "./presets.ts";
import type { Rotation } from "./rotation/index.ts";
import type { Body, Gravity } from "./scenario.ts";

const rotation: Rotation = {
    type: "uniform",
    pole: { x: 0, y: 0, z: 1 },
    w0: 0,
    rate: 1e-4,
};
const gravity: Gravity = { j2: 1e-3, radius: 6e6 };
const presets: Presets = { earth: { rotation, gravity }, mars: { rotation } };

const plain: Body = {
    id: "earth",
    name: "Earth",
    tags: [],
    mass: { mu: 4e14, radius: 6e6 },
    preset: "earth",
};

Deno.test("expandBody fills the rotation and gravity from the preset", () => {
    const body = expandBody(plain, presets);

    assertEquals(body.rotation, rotation);
    assertEquals(body.gravity, gravity);
});

Deno.test("expandBody keeps the gravity and rotation a body sets itself", () => {
    const own: Gravity = { j2: 2e-3, radius: 1 };
    const ownRotation: Rotation = { ...rotation, rate: 5 };
    const body = expandBody(
        { ...plain, gravity: own, rotation: ownRotation },
        presets,
    );

    assertEquals(body.gravity, own);
    assertEquals(body.rotation, ownRotation);
});

Deno.test("expandBody fills only what the preset has", () => {
    const body = expandBody({ ...plain, preset: "mars" }, presets);

    assertEquals(body.rotation, rotation);
    assertEquals(body.gravity, undefined);
});

Deno.test("expandBody returns the same object when nothing changes", () => {
    const unnamed: Body = { ...plain };
    delete unnamed.preset;

    assertStrictEquals(expandBody(unnamed, presets), unnamed);
    assertStrictEquals(expandBody(plain, {}), plain);
    assertStrictEquals(
        expandBody({ ...plain, gravity, rotation }, presets).gravity,
        gravity,
    );
});

Deno.test("expandBody leaves the appearance alone when the preset has none", () => {
    const own = { ...plain, appearance: { color: "#fff" } };

    assertStrictEquals(expandBody(own, { earth: {} }), own);
    assertEquals(expandBody(plain, presets).appearance, undefined);
});

Deno.test("expandBody fills the appearance from the preset", () => {
    const body = expandBody(plain, {
        earth: { appearance: { color: "#00f" } },
    });

    assertEquals(body.appearance, { color: "#00f" });
});

Deno.test("expandBody keeps the appearance a body sets itself", () => {
    const own = { ...plain, appearance: { color: "#fff" } };

    assertStrictEquals(expandBody(own, { earth: {} }), own);
    assertEquals(expandBody(own, { earth: { appearance: undefined } }), own);
});

Deno.test("expandBody merges the appearance by key, with the body winning", () => {
    const body = expandBody(
        { ...plain, appearance: { color: "#fff", glow: 1 } },
        { earth: { appearance: { color: "#00f", rings: 2 } } },
    );

    assertEquals(body.appearance, { color: "#fff", rings: 2, glow: 1 });
});
