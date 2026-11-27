/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/catalog";
import { Clock, type View } from "@cpluspatch/render";
import { documentOf } from "@cpluspatch/sim";
import { assertEquals, assertThrows } from "@std/assert";
import { Scene } from "../state/scene.ts";
import { buildFirst } from "./first-build.ts";

const earthOnly = {
    ...solarSystem,
    bodies: solarSystem.bodies.filter(
        (body) => body.id === "sun" || body.id === "earth",
    ),
};
const view = {} as View;

const setup = (scenario = earthOnly) =>
    new Scene(documentOf(scenario), new Clock(0, 1, false));

Deno.test("a view that builds is returned without a notice", () => {
    const notices: string[] = [];

    const result = buildFirst(
        setup(),
        "saved",
        () => view,
        (text) => notices.push(text),
    );

    assertEquals(result, { view, fellBack: false });
    assertEquals(notices, []);
});

Deno.test("no view is returned as it is", () => {
    const result = buildFirst(
        setup(),
        "saved",
        () => null,
        () => {},
    );

    assertEquals(result, { view: null, fellBack: false });
});

Deno.test("a scenario that can't be drawn falls back to the solar system", () => {
    const scene = setup();
    const notices: string[] = [];
    let calls = 0;

    const result = buildFirst(
        scene,
        "saved",
        () => {
            if (calls++ === 0) throw new Error("no");

            return view;
        },
        (text) => notices.push(text),
    );

    assertEquals(result, { view, fellBack: true });
    assertEquals(scene.scenario.bodies.length, solarSystem.bodies.length);
    assertEquals(notices, [
        "Your saved copy can't be drawn, so the solar system opened.",
    ]);
});

Deno.test("the notice names the link when the scenario came from one", () => {
    const notices: string[] = [];
    let calls = 0;

    buildFirst(
        setup(),
        "link",
        () => (calls++ === 0 ? assertThrowsFirst() : view),
        (text) => notices.push(text),
    );

    assertEquals(notices, [
        "The shared link can't be drawn, so the solar system opened.",
    ]);
});

Deno.test("a fallback with no view shows no notice", () => {
    const notices: string[] = [];
    let calls = 0;

    const result = buildFirst(
        setup(),
        "saved",
        () => (calls++ === 0 ? assertThrowsFirst() : null),
        (text) => notices.push(text),
    );

    assertEquals(result, { view: null, fellBack: true });
    assertEquals(notices, []);
});

Deno.test("the solar system's own error goes to the caller", () => {
    assertThrows(
        () =>
            buildFirst(
                setup(solarSystem),
                "default",
                () => assertThrowsFirst(),
                () => {},
            ),
        Error,
        "no",
    );
});

Deno.test("an error from the second build goes to the caller", () => {
    assertThrows(
        () =>
            buildFirst(
                setup(),
                "saved",
                () => assertThrowsFirst(),
                () => {},
            ),
        Error,
        "no",
    );
});

function assertThrowsFirst(): never {
    throw new Error("no");
}
