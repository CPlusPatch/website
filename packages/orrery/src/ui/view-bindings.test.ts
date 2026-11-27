/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/catalog";
import { Clock, type SatelliteEvent, type View } from "@cpluspatch/render";
import { documentOf } from "@cpluspatch/sim";
import { assertEquals } from "@std/assert";
import { Scene } from "../state/scene.ts";
import {
    bindSceneEvents,
    bindViewEvents,
    bodyName,
    viewShortcuts,
} from "./view-bindings.ts";

const newScene = () =>
    new Scene(documentOf(solarSystem), new Clock(0, 1, false));

/** A view with the satellite and chase parts the bindings use. */
const fakeView = (names: Record<number, string> = {}) => {
    const state = {
        selected: null as number | null,
        focused: null as number | null,
        chasing: false,
        canChase: true,
        satelliteListener: null as ((event: SatelliteEvent) => void) | null,
        chaseListener: null as
            | ((state: { chasing: boolean; canChase: boolean }) => void)
            | null,
        chaseCalls: [] as boolean[],
        focusCalls: [] as number[],
        selectCalls: [] as (number | null)[],
    };
    const view = {
        satellite: {
            selected: () => state.selected,
            focused: () => state.focused,
            select: (k: number | null) => state.selectCalls.push(k),
            focus: (k: number) => state.focusCalls.push(k),
            facts: (k: number) => (k in names ? { name: names[k] } : null),
            on: (fn: (event: SatelliteEvent) => void) => {
                state.satelliteListener = fn;

                return () => {
                    state.satelliteListener = null;
                };
            },
        },
        chasing: () => state.chasing,
        canChase: () => state.canChase,
        chase: (on: boolean) => {
            state.chaseCalls.push(on);

            return true;
        },
        onChase: (
            fn: (state: { chasing: boolean; canChase: boolean }) => void,
        ) => {
            state.chaseListener = fn;

            return () => {
                state.chaseListener = null;
            };
        },
    } as unknown as View;

    return { view, state };
};

Deno.test("the name of a body is its id when the scenario has none by it", () => {
    assertEquals(bodyName(solarSystem.bodies, "earth"), "Earth");
    assertEquals(bodyName(solarSystem.bodies, "nowhere"), "nowhere");
});

Deno.test("a satellite pick is announced by name", () => {
    const { view, state } = fakeView({ 3: "ISS" });
    const said: string[] = [];
    bindViewEvents(view, newScene(), {
        setSatellite: () => {},
        closeKeys: () => {},
        announce: (text) => said.push(text),
    });

    state.satelliteListener?.({ type: "selection", k: 3 });

    assertEquals(said, ["Selected ISS."]);
});

Deno.test("a satellite pick closes the keys card", () => {
    const { view, state } = fakeView({ 3: "ISS" });
    let closed = 0;
    bindViewEvents(view, newScene(), {
        setSatellite: () => {},
        closeKeys: () => closed++,
        announce: () => {},
    });

    state.satelliteListener?.({ type: "selection", k: 3 });
    state.satelliteListener?.({ type: "selection", k: null });

    assertEquals(closed, 1);
});

Deno.test("clearing the satellite stays quiet while a body is selected", () => {
    const { view, state } = fakeView();
    const scene = newScene();
    scene.select("earth");
    const said: string[] = [];
    bindViewEvents(view, scene, {
        setSatellite: () => {},
        closeKeys: () => {},
        announce: (text) => said.push(text),
    });

    state.satelliteListener?.({ type: "selection", k: null });

    assertEquals(said, []);
});

Deno.test("clearing the satellite is announced when no body is selected", () => {
    const { view, state } = fakeView();
    const said: string[] = [];
    bindViewEvents(view, newScene(), {
        setSatellite: () => {},
        closeKeys: () => {},
        announce: (text) => said.push(text),
    });

    state.satelliteListener?.({ type: "selection", k: null });

    assertEquals(said, ["Selection cleared."]);
});

Deno.test("following a satellite sets the crumb, and stopping clears it", () => {
    const { view, state } = fakeView({ 3: "ISS" });
    const crumbs: ({ name: string } | null)[] = [];
    const stop = bindViewEvents(view, newScene(), {
        setSatellite: (crumb) => crumbs.push(crumb),
        closeKeys: () => {},
        announce: () => {},
    });

    state.satelliteListener?.({ type: "focus", k: 3 });
    stop();

    assertEquals(
        crumbs.map((crumb) => crumb?.name ?? null),
        ["ISS", null],
    );
    assertEquals(state.satelliteListener, null);
    assertEquals(state.chaseListener, null);
});

Deno.test("a chase change names the focused satellite, or else the focused body", () => {
    const { view, state } = fakeView({ 3: "ISS" });
    const said: string[] = [];
    bindViewEvents(view, newScene(), {
        setSatellite: () => {},
        closeKeys: () => {},
        announce: (text) => said.push(text),
    });

    state.focused = 3;
    state.chaseListener?.({ chasing: true, canChase: true });
    state.focused = null;
    state.chaseListener?.({ chasing: false, canChase: true });

    assertEquals(said, ["Chasing ISS.", "Orbiting Sun."]);
});

Deno.test("a chase event that doesn't change the chase is quiet", () => {
    const { view, state } = fakeView();
    const said: string[] = [];
    bindViewEvents(view, newScene(), {
        setSatellite: () => {},
        closeKeys: () => {},
        announce: (text) => said.push(text),
    });

    state.chaseListener?.({ chasing: false, canChase: false });

    assertEquals(said, []);
});

Deno.test("the shortcut chases, or says the focus can't be chased", () => {
    const { view, state } = fakeView();
    const said: string[] = [];
    const { toggleChase } = viewShortcuts(
        newScene(),
        () => view,
        (text) => said.push(text),
    );

    toggleChase();
    state.canChase = false;
    toggleChase();

    assertEquals(state.chaseCalls, [true]);
    assertEquals(said, ["Sun orbits nothing, so it can't be chased."]);
});

Deno.test("the satellite shortcuts report whether there was a satellite", () => {
    const { view, state } = fakeView();
    const { clearSatellite, focusSatellite } = viewShortcuts(
        newScene(),
        () => view,
        () => {},
    );

    assertEquals(clearSatellite(), false);
    assertEquals(focusSatellite(), false);

    state.selected = 5;

    assertEquals(focusSatellite(), true);
    assertEquals(clearSatellite(), true);
    assertEquals(state.focusCalls, [5]);
    assertEquals(state.selectCalls, [null]);
});

Deno.test("the shortcuts do nothing without a view", () => {
    const shortcuts = viewShortcuts(
        newScene(),
        () => null,
        () => {},
    );

    assertEquals(shortcuts.clearSatellite(), false);
    assertEquals(shortcuts.focusSatellite(), false);
    shortcuts.toggleChase();
});

Deno.test("scene events are announced, except while settling", () => {
    const scene = newScene();
    const said: string[] = [];
    let settling = false;
    bindSceneEvents(scene, () => settling, {
        closeKeys: () => {},
        announce: (text) => said.push(text),
    });

    scene.select("earth");
    settling = true;
    scene.select("moon");

    assertEquals(said, ["Selected Earth."]);
});

Deno.test("a body selection closes the keys card, and a clear doesn't", () => {
    const scene = newScene();
    let closed = 0;
    bindSceneEvents(scene, () => false, {
        closeKeys: () => closed++,
        announce: () => {},
    });

    scene.select("earth");
    scene.select(null);

    assertEquals(closed, 1);
});
