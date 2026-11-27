/// <reference types="deno" />
import { PRESETS, solarSystem } from "@cpluspatch/catalog";
import { compile, documentOf } from "@cpluspatch/sim";
import { assert, assertEquals } from "@std/assert";
import { liveAt } from "./live.ts";

const doc = documentOf(solarSystem);
const documents = {
    doc,
    system: compile(doc, PRESETS),
    colorOf: () => "#fff",
};

Deno.test("liveAt draws a saved orbit with the times to its apsides", () => {
    const live = liveAt(documents, "moon", 0, null, undefined);

    assert(live.current && live.plate);
    assertEquals(live.plate.timeToPeriapsis, live.current.timeToPeriapsis);
    assertEquals(live.t, 0);
});

Deno.test("liveAt draws an open form's draft, without the times", () => {
    const draft = documents.system.elementsAt("moon", 0);
    const form = { elements: () => ({ ...draft, a: draft.a * 2 }), mu: 4e14 };

    const live = liveAt(documents, "moon", 0, null, form);

    assertEquals(live.plate?.a, draft.a * 2);
    assertEquals(live.plate?.timeToPeriapsis, undefined);
});

Deno.test("liveAt draws the saved orbit while a form has no valid draft", () => {
    const form = { elements: () => null, mu: 4e14 };

    const live = liveAt(documents, "moon", 0, null, form);

    assert(live.plate?.timeToPeriapsis !== undefined);
});

Deno.test("liveAt draws no plate for the body at the centre", () => {
    const live = liveAt(documents, "sun", 0, null, undefined);

    assertEquals(live.plate, null);
});
