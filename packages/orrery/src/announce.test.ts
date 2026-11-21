/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { announcement } from "./announce.ts";

const bodies = [
    { id: "earth", name: "Earth" },
    { id: "moon", name: "Moon" },
];

Deno.test("selecting a body names it", () => {
    assertEquals(
        announcement({ type: "selection", id: "earth" }, bodies),
        "Selected Earth.",
    );
});

Deno.test("clearing the selection says so", () => {
    assertEquals(
        announcement({ type: "selection", id: null }, bodies),
        "Selection cleared.",
    );
});

Deno.test("focusing a body names it", () => {
    assertEquals(
        announcement({ type: "focus", id: "moon" }, bodies),
        "Focused on Moon.",
    );
});

Deno.test("other events, like a rebuilt scenario, say nothing", () => {
    assertEquals(announcement({ type: "scenario" }, bodies), null);
    assertEquals(announcement({ type: "clock" }, bodies), null);
});
