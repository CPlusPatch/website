/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/orbit";
import { assert, assertAlmostEquals } from "@std/assert";
import { Box3, Sphere } from "three";
import { createSpacecraftModel, disposeModel } from "./spacecraft.ts";

const satellites = solarSystem.bodies.filter(
    ({ kind }) => kind === "spacecraft",
);

Deno.test("every satellite has a model", () => {
    assert(satellites.length > 0);
});

Deno.test("a satellite's radius is its model's bounding radius, within 10%", () => {
    for (const body of satellites) {
        const model = createSpacecraftModel(body);
        const { radius } = new Box3()
            .setFromObject(model)
            .getBoundingSphere(new Sphere());
        disposeModel(model);

        // The model is in km and the body in m.
        assertAlmostEquals(
            radius * 1000,
            body.radius,
            body.radius * 0.1,
            body.id,
        );
    }
});

Deno.test("a spacecraft without a model of its own is scaled to its radius", () => {
    const { model: _model, ...first } = satellites[0];
    const body = { ...first, id: "user-sat", radius: 25 };
    const model = createSpacecraftModel(body);
    const { radius } = new Box3()
        .setFromObject(model)
        .getBoundingSphere(new Sphere());
    disposeModel(model);

    assertAlmostEquals(radius * 1000, 25, 1e-9);
});
