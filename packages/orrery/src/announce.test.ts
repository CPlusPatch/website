/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import {
    announcement,
    bareAnnouncement,
    chaseAnnouncement,
    historyAnnouncement,
    noChaseAnnouncement,
    presenceAnnouncement,
    satelliteAnnouncement,
} from "./announce.ts";

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

Deno.test("selecting a satellite names it", () => {
    assertEquals(
        satelliteAnnouncement({ type: "selection", k: 4 }, "ISS (ZARYA)"),
        "Selected ISS (ZARYA).",
    );
});

Deno.test("clearing a satellite selection says so", () => {
    assertEquals(
        satelliteAnnouncement({ type: "selection", k: null }, null),
        "Selection cleared.",
    );
});

Deno.test("focusing a satellite names it", () => {
    assertEquals(
        satelliteAnnouncement({ type: "focus", k: 4 }, "ISS (ZARYA)"),
        "Focused on ISS (ZARYA).",
    );
});

Deno.test("ending a satellite focus says nothing, as the scene's focus event does", () => {
    assertEquals(satelliteAnnouncement({ type: "focus", k: null }, null), null);
});

Deno.test("the chase says whether the camera chases or orbits, and what", () => {
    assertEquals(chaseAnnouncement(true, "Mars"), "Chasing Mars.");
    assertEquals(chaseAnnouncement(false, "Mars"), "Orbiting Mars.");
});

Deno.test("hiding the interface says how to show it again", () => {
    assertEquals(
        bareAnnouncement(true),
        "Interface, labels and orbits hidden. F1 shows them.",
    );
    assertEquals(bareAnnouncement(false), "Interface shown.");
});

Deno.test("chasing a body that orbits nothing says why it can't", () => {
    assertEquals(
        noChaseAnnouncement("Sun"),
        "Sun orbits nothing, so it can't be chased.",
    );
});

Deno.test("undo and redo name the edit, or say there is none", () => {
    assertEquals(
        historyAnnouncement("undo", "adding Vesta"),
        "Undid adding Vesta.",
    );
    assertEquals(
        historyAnnouncement("redo", "adding Vesta"),
        "Redid adding Vesta.",
    );
    assertEquals(historyAnnouncement("undo", null), "Nothing to undo.");
    assertEquals(historyAnnouncement("redo", null), "Nothing to redo.");
});

Deno.test("a body that left while it was focused says where the focus went", () => {
    assertEquals(
        presenceAnnouncement(
            { gone: ["moon"], focused: "earth", deselected: false },
            bodies,
        ),
        "Moon isn't there at this date. Focused on Earth.",
    );
});

Deno.test("a body that left while it was selected says the selection cleared", () => {
    assertEquals(
        presenceAnnouncement(
            { gone: ["moon"], focused: null, deselected: true },
            bodies,
        ),
        "Moon isn't there at this date. Selection cleared.",
    );
});

Deno.test("a body that was focused and selected says both", () => {
    assertEquals(
        presenceAnnouncement(
            { gone: ["moon"], focused: "earth", deselected: true },
            bodies,
        ),
        "Moon isn't there at this date. Focused on Earth. Selection cleared.",
    );
});

Deno.test("two bodies that left are named together, with an id for an unknown one", () => {
    assertEquals(
        presenceAnnouncement(
            { gone: ["moon", "probe"], focused: "earth", deselected: true },
            bodies,
        ),
        "Moon and probe aren't there at this date. Focused on Earth. Selection cleared.",
    );
});
