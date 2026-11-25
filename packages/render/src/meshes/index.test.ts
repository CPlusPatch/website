/// <reference types="deno" />
import { PRESETS, solarSystem } from "@cpluspatch/catalog";
import { type Body, expandBody } from "@cpluspatch/sim";
import {
    assert,
    assertAlmostEquals,
    assertEquals,
    assertExists,
} from "@std/assert";
import { Box3, type Group, Sphere } from "three";
import { appearanceOf } from "../appearance.ts";
import { createMesh, disposeMesh, validateMesh } from "./index.ts";

const satellites = solarSystem.bodies
    .map((body) => expandBody(body, PRESETS))
    .filter(({ tags }) => tags.includes("spacecraft"));

// The bounding radius of a mesh, in m. The mesh is in km.
const radiusOf = (mesh: Group): number =>
    new Box3().setFromObject(mesh).getBoundingSphere(new Sphere()).radius *
    1000;

const meshOf = (body: Body): Group | null => {
    const { mesh } = appearanceOf(body);

    return mesh ? createMesh(body, mesh) : null;
};

const errorsOf = (mesh: unknown): string[] => {
    const errors: string[] = [];
    validateMesh("a", mesh, errors);

    return errors;
};

const first = (): Body => {
    const [satellite] = satellites;

    assertExists(satellite);

    return satellite;
};

Deno.test("every spacecraft has a mesh", () => {
    assert(satellites.length > 0);

    for (const body of satellites) {
        const mesh = meshOf(body);

        assertExists(mesh, body.id);
        disposeMesh(mesh);
    }
});

Deno.test("a spacecraft's radius is its mesh's bounding radius, within 10%", () => {
    for (const body of satellites) {
        const mesh = meshOf(body);

        assertExists(mesh, body.id);
        const radius = radiusOf(mesh);
        disposeMesh(mesh);

        assertAlmostEquals(
            radius,
            body.mass.radius,
            body.mass.radius * 0.1,
            body.id,
        );
    }
});

Deno.test("a spacecraft without a preset draws the generic bus scaled to its radius", () => {
    const { preset: _preset, appearance: _appearance, ...rest } = first();
    const body = {
        ...rest,
        id: "user-sat",
        mass: { ...rest.mass, radius: 25 },
    };
    const mesh = meshOf(body);

    assertExists(mesh);
    const radius = radiusOf(mesh);
    disposeMesh(mesh);

    assertAlmostEquals(radius, 25, 1e-9);
});

Deno.test("a bus with a size is drawn at true size, whatever the body's radius", () => {
    const { preset: _preset, appearance: _appearance, ...rest } = first();
    const body: Body = {
        ...rest,
        id: "user-sat",
        mass: { ...rest.mass, radius: 25 },
        appearance: { mesh: { type: "bus", size: [4, 4, 4] } },
    };
    const mesh = meshOf(body);

    assertExists(mesh);
    const radius = radiusOf(mesh);
    disposeMesh(mesh);

    assert(Math.abs(radius - 25) > 1, `radius was ${radius}`);
});

Deno.test("an unknown mesh type gives no mesh", () => {
    assertEquals(createMesh(first(), { type: "nope" }), null);
    assertEquals(createMesh(first(), { type: "toString" }), null);
});

Deno.test("an unknown type is valid and a known one with good params is too", () => {
    assertEquals(errorsOf({ type: "nope", anything: 1 }), []);
    assertEquals(errorsOf({ type: "iss" }), []);
    assertEquals(
        errorsOf({
            type: "bus",
            size: [1, 2, 3],
            wings: 2,
            antenna: [1, 1],
            shield: { shape: "plate", size: 2, thickness: 0.1 },
        }),
        [],
    );
});

Deno.test("a mesh that isn't an object with a string type is reported", () => {
    assertEquals(errorsOf("bus"), ['a.mesh: must be an object (got "bus")']);
    assertEquals(errorsOf({ type: 3 }), [
        "a.mesh.type: must be a string (got 3)",
    ]);
    assertEquals(errorsOf({}), [
        "a.mesh.type: must be a string (got undefined)",
    ]);
});

Deno.test("bad bus params are reported with their paths", () => {
    assertEquals(errorsOf({ type: "bus", size: [1, 2] }), [
        "a.mesh.size: must be 3 numbers above 0 (got object)",
    ]);
    assertEquals(errorsOf({ type: "bus", size: [1, 0, 1] }), [
        "a.mesh.size: must be 3 numbers above 0 (got object)",
    ]);
    assertEquals(errorsOf({ type: "bus", wings: 3 }), [
        "a.mesh.wings: must be 1 or 2 (got 3)",
    ]);
    assertEquals(errorsOf({ type: "bus", dish: -1 }), [
        "a.mesh.dish: must be a number above 0 (got -1)",
    ]);
    assertEquals(
        errorsOf({
            type: "bus",
            shield: { shape: "cone", size: 1, thickness: 0 },
        }),
        [
            'a.mesh.shield.shape: must be "disc" or "plate" (got "cone")',
            "a.mesh.shield.thickness: must be a number above 0 (got 0)",
        ],
    );
});
