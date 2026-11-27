/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/catalog";
import { documentOf, type Scenario } from "@cpluspatch/sim";
import { assertEquals } from "@std/assert";
import type { SavedScenario } from "../../persistence.ts";
import {
    bodyCount,
    newestFirst,
    savedMeta,
    withoutSaved,
    withSaved,
} from "./rows.ts";

const withBodies = (count: number, time?: number): Scenario => ({
    ...solarSystem,
    bodies: solarSystem.bodies.slice(0, count),
    time,
});

Deno.test("bodyCount says body for one and bodies otherwise", () => {
    assertEquals(bodyCount(withBodies(1)), "1 body");
    assertEquals(bodyCount(withBodies(3)), "3 bodies");
    assertEquals(bodyCount(withBodies(0)), "0 bodies");
});

Deno.test("savedMeta shows the scenario's own start date", () => {
    // Time 0 is J2000, which is 2000-01-01.
    const meta = savedMeta({
        savedAt: Date.UTC(2026, 10, 22),
        doc: documentOf(withBodies(2, 0)),
    });

    assertEquals(meta, "2 bodies · 2000-01-01");
});

Deno.test("savedMeta falls back to the save date when the scenario has no time", () => {
    const meta = savedMeta({
        savedAt: Date.UTC(2026, 10, 22),
        doc: documentOf(withBodies(2)),
    });

    assertEquals(meta, "2 bodies · 2026-11-22");
});

const savedAt = (name: string, at: number): SavedScenario => ({
    savedAt: at,
    doc: documentOf({ ...withBodies(1), name }),
});

Deno.test("newestFirst sorts by save time and keeps each entry's index", () => {
    const saved = [savedAt("a", 10), savedAt("b", 30), savedAt("c", 20)];

    const rows = newestFirst(saved);

    assertEquals(
        rows.map(({ index }) => index),
        [1, 2, 0],
    );
    assertEquals(rows[0]?.entry, saved[1]);
});

Deno.test("newestFirst leaves the saved list as it was", () => {
    const saved = [savedAt("a", 10), savedAt("b", 30)];

    newestFirst(saved);

    assertEquals(
        saved.map(({ doc }) => doc.scenario.name),
        ["a", "b"],
    );
});

Deno.test("withSaved appends the document under the new name", () => {
    const saved = [savedAt("a", 10)];
    const doc = documentOf({ ...withBodies(2), name: "Old" });

    const next = withSaved(saved, doc, "New", 99);

    assertEquals(next.length, 2);
    assertEquals(next[0], saved[0]);
    assertEquals(next[1]?.savedAt, 99);
    assertEquals(next[1]?.doc.scenario.name, "New");
    assertEquals(next[1]?.doc.scenario.bodies, doc.scenario.bodies);
    assertEquals(doc.scenario.name, "Old");
    assertEquals(saved.length, 1);
});

Deno.test("withoutSaved drops only the entry at the index", () => {
    const saved = [savedAt("a", 10), savedAt("b", 20), savedAt("c", 30)];

    const next = withoutSaved(saved, 1);

    assertEquals(
        next.map(({ doc }) => doc.scenario.name),
        ["a", "c"],
    );
    assertEquals(saved.length, 3);
});
