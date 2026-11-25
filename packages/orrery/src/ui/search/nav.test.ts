/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/catalog";
import { AU } from "@cpluspatch/orbit";
import { formatRange } from "@cpluspatch/render";
import type { Body } from "@cpluspatch/sim";
import { assertEquals } from "@std/assert";
import {
    firstOf,
    named,
    optionId,
    placeAtOpen,
    rangesFor,
    reconcile,
    rootNote,
    rowIds,
    step,
    systemIds,
    widened,
} from "./nav.ts";

const solar = solarSystem.bodies;
const IDS = ["a", "b", "c"];

/** The solar system without the bodies in `gone`. */
const without = (...gone: string[]): Body[] =>
    solar.filter((body) => !gone.includes(body.id));

Deno.test("the option id names the list and the body", () => {
    assertEquals(optionId("hit", "moon"), "orrery-search-hit-moon");
});

Deno.test("the Sun is named with an article and other bodies by name", () => {
    const [sun, earth] = [solar[0], solar.find((body) => body.id === "earth")];

    assertEquals(sun && named(sun), "the Sun");
    assertEquals(earth && named(earth), "Earth");
});

Deno.test("Down and Up move one row and stop at the ends", () => {
    assertEquals(step(IDS, "a", "ArrowDown"), "b");
    assertEquals(step(IDS, "c", "ArrowDown"), "c");
    assertEquals(step(IDS, "b", "ArrowUp"), "a");
    assertEquals(step(IDS, "a", "ArrowUp"), "a");
});

Deno.test("Home and End jump to the first and last row", () => {
    assertEquals(step(IDS, "b", "Home"), "a");
    assertEquals(step(IDS, "b", "End"), "c");
});

Deno.test("with no active row, Down and Up land on the first row", () => {
    assertEquals(step(IDS, null, "ArrowDown"), "a");
    assertEquals(step(IDS, null, "ArrowUp"), "a");
});

Deno.test("an active row that isn't listed counts as before the first", () => {
    assertEquals(step(IDS, "gone", "ArrowDown"), "a");
});

Deno.test("a step over no rows is undefined, so the active row stays", () => {
    assertEquals(step([], "a", "ArrowDown"), undefined);
});

Deno.test("the first row of a system is its first moon", () => {
    assertEquals(firstOf(solar, "earth"), "moon");
});

Deno.test("the root and a body with nothing around it have no first row", () => {
    assertEquals(firstOf(solar, "sun"), null);
    assertEquals(firstOf(solar, "mercury"), null);
});

Deno.test("the right pane lists a system's rows, and none for the root", () => {
    assertEquals(systemIds(solar, "jupiter").slice(0, 2), ["io", "europa"]);
    assertEquals(systemIds(solar, "sun"), []);
});

Deno.test("the root note counts its children and says where to pick", () => {
    const count = solar.filter((body) => body.orbit?.parent === "sun").length;

    assertEquals(
        rootNote(solar, false),
        `${count} bodies orbit the Sun. Pick one on the left, or type to search.`,
    );
    assertEquals(
        rootNote(solar, true),
        `${count} bodies orbit the Sun. Go back to pick one, or type to search.`,
    );
});

Deno.test("the root note uses the singular for one child", () => {
    const two = solar.filter((body) => ["sun", "earth"].includes(body.id));

    assertEquals(
        rootNote(two, false),
        "1 body orbits the Sun. Pick one on the left, or type to search.",
    );
});

Deno.test("the left pane's rows are the root, then its children by group", () => {
    const ids = rowIds(solar, "", { shown: "sun", pane: "left" });

    assertEquals(ids.slice(0, 3), ["sun", "mercury", "venus"]);
    assertEquals(ids.at(-1), "solar-orbiter");
});

Deno.test("the right pane's rows are the shown system's", () => {
    assertEquals(rowIds(solar, "", { shown: "jupiter", pane: "right" }), [
        "io",
        "europa",
        "ganymede",
        "callisto",
        "juno",
    ]);
});

Deno.test("the right pane has no rows when its body is gone", () => {
    assertEquals(rowIds(solar, "", { shown: "nowhere", pane: "right" }), []);
});

Deno.test("with a query, the rows are the matches from every system", () => {
    assertEquals(rowIds(solar, "europa", { shown: "sun", pane: "left" }), [
        "europa",
    ]);
});

Deno.test("with no pick, the panel opens on the root", () => {
    assertEquals(placeAtOpen(solar, null), {
        shown: "sun",
        pane: "left",
        active: "sun",
    });
});

Deno.test("a pick that isn't in the scenario opens on the root", () => {
    assertEquals(placeAtOpen(solar, "nowhere"), {
        shown: "sun",
        pane: "left",
        active: "sun",
    });
});

Deno.test("a child of the root opens on its own row in the left pane", () => {
    assertEquals(placeAtOpen(solar, "earth"), {
        shown: "earth",
        pane: "left",
        active: "earth",
    });
});

Deno.test("a body deeper down opens in the right pane on the root child it orbits", () => {
    assertEquals(placeAtOpen(solar, "europa"), {
        shown: "jupiter",
        pane: "right",
        active: "europa",
    });
});

Deno.test("a moon's craft walks up two levels to the root child", () => {
    assertEquals(placeAtOpen(solar, "lro"), {
        shown: "earth",
        pane: "right",
        active: "lro",
    });
});

Deno.test("a pick whose planet is gone opens on the root", () => {
    assertEquals(placeAtOpen(without("jupiter"), "io"), {
        shown: "sun",
        pane: "left",
        active: "sun",
    });
});

Deno.test("a scenario that still has the place leaves it alone", () => {
    const place = { shown: "jupiter", pane: "right" as const, active: "io" };

    assertEquals(reconcile(solar, place, ""), place);
});

Deno.test("when the shown body is gone, the left pane shows the root", () => {
    const place = { shown: "jupiter", pane: "right" as const, active: "io" };

    assertEquals(reconcile(without("jupiter", "io"), place, ""), {
        shown: "sun",
        pane: "left",
        active: "sun",
    });
});

Deno.test("when only the active row is gone, the shown body gets it", () => {
    const place = { shown: "jupiter", pane: "right" as const, active: "io" };

    assertEquals(reconcile(without("io"), place, ""), {
        shown: "jupiter",
        pane: "left",
        active: "jupiter",
    });
});

Deno.test("with a query, a gone active row moves to the first match", () => {
    const place = { shown: "sun", pane: "left" as const, active: "io" };

    assertEquals(reconcile(without("io"), place, "europa"), {
        shown: "sun",
        pane: "left",
        active: "europa",
    });
});

Deno.test("with a query that matches nothing, there is no active row", () => {
    const place = { shown: "sun", pane: "left" as const, active: "sun" };

    assertEquals(reconcile(solar, place, "zzzz").active, null);
});

Deno.test("with a query, an active row that still matches stays", () => {
    const place = { shown: "sun", pane: "left" as const, active: "io" };

    assertEquals(reconcile(solar, place, "o").active, "io");
});

Deno.test("a wide screen moves the right pane to the left when it has no active row", () => {
    assertEquals(widened({ shown: "earth", pane: "right", active: null }), {
        shown: "earth",
        pane: "left",
        active: "earth",
    });
});

Deno.test("a wide screen keeps the right pane when it has an active row", () => {
    const place = { shown: "earth", pane: "right" as const, active: "moon" };

    assertEquals(widened(place), place);
});

Deno.test("a range reads in the unit of the list's largest distance", () => {
    const range = rangesFor(
        new Map([
            ["far", 5 * AU],
            ["near", AU],
        ]),
        null,
        ["far", "near"],
    );

    assertEquals(range("near"), formatRange(AU, "AU"));
    assertEquals(range("far"), formatRange(5 * AU, "AU"));
});

Deno.test("a chosen unit wins over the list's largest distance", () => {
    const range = rangesFor(new Map([["a", 5 * AU]]), "km", ["a"]);

    assertEquals(range("a"), formatRange(5 * AU, "km"));
});

Deno.test("a body with no distance has an empty range", () => {
    const range = rangesFor(new Map([["a", null]]), null, ["a", "b"]);

    assertEquals(range("a"), "");
    assertEquals(range("b"), "");
});
