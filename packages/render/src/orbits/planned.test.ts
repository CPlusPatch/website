/// <reference types="deno" />
import { PRESETS, solarSystem } from "@cpluspatch/catalog";
import { compile, documentOf, type TimelineEvent } from "@cpluspatch/sim";
import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { plannedElements } from "./planned.ts";

const EVENT_T = 1e8;

const burn: TimelineEvent = {
    type: "burn",
    id: "e1",
    bodyId: "iss",
    t: EVENT_T,
    dv: { prograde: 50, normal: 10, radial: 0 },
};

const withBurn = compile(
    { ...documentOf(solarSystem), timeline: [burn] },
    PRESETS,
);
const without = compile(documentOf(solarSystem), PRESETS);

Deno.test("a body with no events has no planned orbit", () => {
    assertEquals(plannedElements(without, "iss", 0), null);
});

Deno.test("before an event, the planned orbit is the one after it, from its time", () => {
    const planned = plannedElements(withBurn, "iss", EVENT_T / 2);

    assert(planned);
    assertEquals(planned.from, EVENT_T);
    assertNotEquals(
        planned.elements,
        withBurn.segmentAt("iss", EVENT_T / 2).elements,
    );
    assertEquals(planned.elements, withBurn.elementsAt("iss", EVENT_T));
});

Deno.test("after the last event there is no planned orbit", () => {
    assertEquals(plannedElements(withBurn, "iss", EVENT_T), null);
    assertEquals(plannedElements(withBurn, "iss", EVENT_T * 2), null);
});

Deno.test("another body has no planned orbit from an event of one", () => {
    assertEquals(plannedElements(withBurn, "earth", 0), null);
});

Deno.test("the root has no planned orbit", () => {
    assertEquals(plannedElements(withBurn, "sun", 0), null);
});
