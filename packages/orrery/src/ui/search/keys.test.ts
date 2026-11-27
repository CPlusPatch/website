/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/catalog";
import { assertEquals } from "@std/assert";
import { type KeyState, keyResult } from "./keys.ts";

const bodies = solarSystem.bodies;

/** A state browsing the tree on the Sun, with `over` applied. */
const stateOf = (over: Partial<KeyState> = {}): KeyState => ({
    bodies,
    query: "",
    narrow: false,
    shown: "sun",
    pane: "left",
    active: "sun",
    ...over,
});

Deno.test("Down in the tree moves the active row and the shown system with it", () => {
    const result = keyResult("ArrowDown", false, stateOf());

    assertEquals(result?.type === "go" && result.place, {
        shown: "mercury",
        pane: "left",
        active: "mercury",
    });
});

Deno.test("Down in the right pane moves the active row only", () => {
    const state = stateOf({ shown: "earth", pane: "right", active: null });
    const result = keyResult("ArrowDown", false, state);

    assertEquals(result, {
        type: "go",
        place: { shown: "earth", pane: "right", active: "moon" },
    });
});

Deno.test("Down in a query moves through the matches and leaves the shown system", () => {
    const result = keyResult("ArrowDown", false, stateOf({ query: "mo" }));

    assertEquals(result?.type, "go");
    assertEquals(result?.type === "go" && result.place.shown, "sun");
});

Deno.test("Home and End keep the caret while there is a query", () => {
    assertEquals(keyResult("Home", false, stateOf({ query: "mo" })), null);
    assertEquals(keyResult("End", false, stateOf({ query: "mo" })), null);
});

Deno.test("End in the tree jumps to the last row", () => {
    const result = keyResult("End", false, stateOf());
    const place = result?.type === "go" ? result.place : undefined;

    assertEquals(place?.active, place?.shown);
    assertEquals(place?.active === "sun", false);
});

Deno.test("an arrow over no rows changes nothing but is still handled", () => {
    const state = stateOf({ shown: "mercury", pane: "right", active: null });

    assertEquals(keyResult("ArrowDown", false, state), { type: "none" });
});

Deno.test("Enter picks the active row, and Shift+Enter picks it to focus", () => {
    const state = stateOf({ active: "earth" });

    assertEquals(keyResult("Enter", false, state), {
        type: "pick",
        id: "earth",
        andFocus: false,
    });
    assertEquals(keyResult("Enter", true, state), {
        type: "pick",
        id: "earth",
        andFocus: true,
    });
});

Deno.test("Enter with a query and no match adds the query", () => {
    const state = stateOf({ query: "zzz", active: null });

    assertEquals(keyResult("Enter", false, state), { type: "add" });
});

Deno.test("Enter in the right pane with no active row picks the shown body", () => {
    const state = stateOf({ shown: "earth", pane: "right", active: null });

    assertEquals(keyResult("Enter", true, state), {
        type: "pick",
        id: "earth",
        andFocus: true,
    });
});

Deno.test("Enter in the left pane with no active row does nothing", () => {
    assertEquals(keyResult("Enter", false, stateOf({ active: null })), {
        type: "none",
    });
});

Deno.test("Right opens the system of the shown body on its first row", () => {
    const state = stateOf({ shown: "earth", active: "earth" });

    assertEquals(keyResult("ArrowRight", false, state), {
        type: "go",
        place: { shown: "earth", pane: "right", active: "moon" },
    });
});

Deno.test("Right on a body with no system does nothing wide, and opens the empty pane narrow", () => {
    const state = stateOf({ shown: "mercury", active: "mercury" });

    assertEquals(keyResult("ArrowRight", false, state), { type: "none" });
    assertEquals(keyResult("ArrowRight", false, { ...state, narrow: true }), {
        type: "go",
        place: { shown: "mercury", pane: "right", active: null },
    });
});

Deno.test("Left in the right pane goes back", () => {
    const state = stateOf({ shown: "earth", pane: "right", active: "moon" });

    assertEquals(keyResult("ArrowLeft", false, state), { type: "back" });
});

Deno.test("Left and Right keep the caret while there is a query", () => {
    assertEquals(keyResult("ArrowRight", false, stateOf({ query: "e" })), null);
    assertEquals(
        keyResult("ArrowLeft", false, stateOf({ query: "e", pane: "right" })),
        null,
    );
});

Deno.test("Left in the left pane and other keys are left to the input", () => {
    assertEquals(keyResult("ArrowLeft", false, stateOf()), null);
    assertEquals(keyResult("a", false, stateOf()), null);
});
