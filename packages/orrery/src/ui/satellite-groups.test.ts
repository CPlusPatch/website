/// <reference types="deno" />
import { SNAPSHOT_WINDOW } from "@cpluspatch/sim";
import { assertEquals } from "@std/assert";
import { GROUP_CLASSES } from "../catalogue-snapshot.ts";
import {
    ALL,
    EPOCH,
    footLines,
    itemLabel,
    LABELS,
    outsideNote,
    present,
    shownCounts,
    total,
} from "./satellite-groups.ts";

Deno.test("shownCounts adds up the orbit classes of the groups that are on", () => {
    const row = shownCounts(["navigation", "weather"]);

    assertEquals(row.counts, { leo: 20, meo: 126, geo: 49, heo: 0 });
    assertEquals(row.shown, 195);
    assertEquals(row.rest, ALL - 195);
});

Deno.test("shownCounts shows nothing when no group is on", () => {
    const row = shownCounts([]);

    assertEquals(row.counts, { leo: 0, meo: 0, geo: 0, heo: 0 });
    assertEquals(row.shown, 0);
    assertEquals(row.rest, ALL);
});

Deno.test("shownCounts leaves no rest when every group is on", () => {
    const row = shownCounts(
        Object.keys(GROUP_CLASSES) as (keyof typeof GROUP_CLASSES)[],
    );

    assertEquals(row.shown, ALL);
    assertEquals(row.rest, 0);
});

Deno.test("itemLabel names the group and how many satellites it holds", () => {
    assertEquals(itemLabel("starlink"), `${LABELS.starlink}, 11,199`);
    assertEquals(itemLabel("navigation"), "Navigation, 150");
});

Deno.test("present lists only the orbit classes that have satellites", () => {
    assertEquals(present(GROUP_CLASSES.navigation), ["meo", "geo"]);
    assertEquals(present(GROUP_CLASSES.starlink), ["leo"]);
    assertEquals(total("navigation"), 150);
});

Deno.test("outsideNote is null inside the snapshot's window", () => {
    assertEquals(outsideNote(EPOCH), null);
    assertEquals(outsideNote(EPOCH + SNAPSHOT_WINDOW), null);
    assertEquals(outsideNote(EPOCH - SNAPSHOT_WINDOW), null);
});

Deno.test("outsideNote says 1 year in the singular just outside the window", () => {
    assertEquals(
        outsideNote(EPOCH + SNAPSHOT_WINDOW + 1),
        "The clock is over 1 year after the snapshot.",
    );
});

Deno.test("outsideNote says before for a clock earlier than the snapshot", () => {
    assertEquals(
        outsideNote(EPOCH - SNAPSHOT_WINDOW - 1),
        "The clock is over 1 year before the snapshot.",
    );
});

Deno.test("outsideNote says years in the plural from two window lengths", () => {
    assertEquals(
        outsideNote(EPOCH + 2.5 * SNAPSHOT_WINDOW),
        "The clock is over 2 years after the snapshot.",
    );
});

Deno.test("footLines names the snapshot date and the always-shown satellites", () => {
    const [snapshot, curated] = footLines();

    assertEquals(snapshot?.startsWith("Orbits from CelesTrak, "), true);
    assertEquals(curated?.endsWith(" others are always shown."), true);
});
