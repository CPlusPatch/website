import { type AUnit, formatRange, listUnit } from "@cpluspatch/render";
import type { Body } from "@cpluspatch/sim";
import { found, treeOrder } from "../../search.ts";
import { type Group, leftPane, system } from "../../systems.ts";

/** The list a row belongs to. It keeps the ids of the three lists apart. */
export type Pane = "left" | "right" | "hit";

/** Where the panel is: the body whose system the right pane shows, the pane in use and its active row. */
export type Place = {
    shown: string;
    pane: "left" | "right";
    active: string | null;
};

/** The keys that move the active row. */
export type StepKey = "ArrowDown" | "ArrowUp" | "Home" | "End";

/** The keys of the hint: the symbols, what a screen reader says for them and the action. */
export type HintKey = [symbol: string, label: string, action: string];

const UP_DOWN: HintKey = ["↑↓", "Up and Down", "move"];
const PICK: HintKey = ["↵", "Enter", "pick"];
const FOCUS: HintKey = ["⇧↵", "Shift+Enter", "focus"];
const CLOSE: HintKey = ["esc", "Escape", "close"];

/** The hint while browsing the tree. */
export const TREE_HINT: HintKey[] = [
    UP_DOWN,
    ["→", "Right", "open"],
    ["←", "Left", "back"],
    PICK,
    FOCUS,
    CLOSE,
];

/** The hint while a query lists matches. */
export const RESULTS_HINT: HintKey[] = [UP_DOWN, PICK, FOCUS, CLOSE];

/** The DOM id of a body's option, which the search box names in `aria-activedescendant`. */
export const optionId = (pane: Pane, id: string): string =>
    `orrery-search-${pane}-${id}`;

/** A body's name in a sentence: "the Sun", or the name itself. */
export const named = (body: Body): string =>
    body.name === "Sun" ? "the Sun" : body.name;

/** The ids of the rows of `groups`, top to bottom. */
export const idsOf = (groups: Group[]): string[] =>
    groups.flatMap((group) => group.rows.map((row) => row.body.id));

/** The first row of the right pane for `id`. The root has none, since the pane shows a note. */
export const firstOf = (bodies: readonly Body[], id: string): string | null =>
    id === leftPane(bodies).root.id
        ? null
        : (system(bodies, id)[0]?.rows[0]?.body.id ?? null);

/** The note the right pane shows for the root. `narrow` is true when the right pane covers the left one. */
export const rootNote = (bodies: readonly Body[], narrow: boolean): string => {
    const { root } = leftPane(bodies);
    const count = bodies.filter(
        (body) => body.orbit?.parent === root.id,
    ).length;

    return `${count} ${count === 1 ? "body orbits" : "bodies orbit"} ${named(root)}. ${narrow ? "Go back to pick one" : "Pick one on the left"}, or type to search.`;
};

/** The ids of the options in the right pane. The root has none, since the pane shows a note. */
export const systemIds = (bodies: readonly Body[], id: string): string[] =>
    id === leftPane(bodies).root.id ? [] : idsOf(system(bodies, id));

/**
 * The text of a row's range for the ids of one list. All the rows share the unit `chosen`, or
 * that of the largest distance.
 */
export const rangesFor = (
    distances: ReadonlyMap<string, number | null>,
    chosen: AUnit | null,
    ids: readonly string[],
): ((id: string) => string) => {
    const unit = listUnit(
        ids.flatMap((id) => distances.get(id) ?? []),
        chosen,
    );

    return (id) => {
        const metres = distances.get(id) ?? null;

        return metres === null ? "" : formatRange(metres, unit);
    };
};

/** The ids of the rows the arrow keys move through, top to bottom. */
export const rowIds = (
    bodies: readonly Body[],
    query: string,
    { shown, pane }: Pick<Place, "shown" | "pane">,
): string[] => {
    if (query.trim() !== "") {
        return found(treeOrder(bodies), query).map((body) => body.id);
    }

    if (pane === "left") {
        const { root, groups } = leftPane(bodies);

        return [root.id, ...idsOf(groups)];
    }

    return bodies.some((body) => body.id === shown)
        ? idsOf(system(bodies, shown))
        : [];
};

/** The row `key` moves to from `active`, or undefined when there are no rows. Up and Down stop at the ends. */
export const step = (
    ids: readonly string[],
    active: string | null,
    key: StepKey,
): string | null | undefined => {
    if (ids.length === 0) return undefined;

    const at = active === null ? -1 : ids.indexOf(active);
    const next =
        key === "Home"
            ? 0
            : key === "End"
              ? ids.length - 1
              : Math.min(
                    ids.length - 1,
                    Math.max(0, at + (key === "ArrowDown" ? 1 : -1)),
                );

    return ids[next] ?? null;
};

/** Where an opening panel lands: on the picked body, or on the root child it orbits. */
export const placeAtOpen = (
    bodies: readonly Body[],
    selected: string | null,
): Place => {
    const { root } = leftPane(bodies);
    const picked = bodies.find((body) => body.id === selected);

    if (!picked || picked.id === root.id || picked.orbit?.parent === root.id) {
        const id = picked?.id ?? root.id;

        return { shown: id, pane: "left", active: id };
    }

    // Walk up to the child of the root that the picked body orbits.
    let ancestor: Body = picked;
    while (ancestor.orbit?.parent !== root.id) {
        const next = bodies.find((body) => body.id === ancestor.orbit?.parent);
        if (!next) break;

        ancestor = next;
    }

    const shown = ancestor.orbit?.parent === root.id ? ancestor.id : root.id;
    const pane = shown === root.id ? "left" : "right";

    return { shown, pane, active: pane === "left" ? shown : picked.id };
};

/** `place` fixed up for a scenario that changed under an open panel, with `query` in the box. */
export const reconcile = (
    bodies: readonly Body[],
    place: Place,
    query: string,
): Place => {
    const { root } = leftPane(bodies);
    const searching = query.trim() !== "";
    const has = (id: string | null) => bodies.some((body) => body.id === id);
    let { shown, pane, active } = place;

    if (!has(shown)) {
        shown = root.id;
        if (!searching) {
            pane = "left";
            active = shown;
        }
    }

    if (active !== null && !has(active)) {
        pane = "left";
        active = searching ? null : shown;
    }

    if (searching) {
        const hits = found(treeOrder(bodies), query);
        if (!hits.some((hit) => hit.id === active)) {
            active = hits[0]?.id ?? null;
        }
    }

    return { shown, pane, active };
};

/** The pane after a narrow query change. Wide, the right pane needs an active row to be there at all. */
export const widened = (place: Place): Place =>
    place.pane === "right" && place.active === null
        ? { ...place, pane: "left", active: place.shown }
        : place;
