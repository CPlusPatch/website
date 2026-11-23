import type { Body } from "@cpluspatch/orbit";
import { formatDuration, formatRadius } from "../format.ts";
import { marked } from "../search.ts";
import { facts, type Group, leftPane, system } from "../systems.ts";
import { showBodyMarker } from "./body-marker.ts";
import { h } from "./dom.ts";
import { KIND_LABELS, ROLE_LABELS } from "./labels.ts";

/** What the builders read: the bodies, the picked one and the live range of a body. */
export type SystemsContext = {
    bodies: readonly Body[];
    picked: string | null;
    range: (id: string) => string;
};

/** The list a row belongs to. It keeps the ids of the three lists apart. */
export type Pane = "left" | "right" | "hit";

type RowOptions = {
    pane: Pane;
    active: boolean;
    /** The row whose system the right pane shows. */
    shown?: boolean;
    nested?: boolean;
    /** Adds the chevron, hidden when the body has no system. */
    chevron?: boolean;
    /** Makes the row two lines, with the match in this query in bold. */
    query?: string;
};

const CHEVRON =
    '<svg viewBox="0 0 8 12" aria-hidden="true" focusable="false"><path d="M1.5 1.5 6.5 6l-5 4.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

export const optionId = (pane: Pane, id: string): string =>
    `orrery-search-${pane}-${id}`;

const marker = (body: Body, size: "row" | "head"): HTMLElement => {
    const element = h("span", {
        class: `orrery__search-marker orrery__search-marker--${size}`,
    });
    showBodyMarker(element, body);

    return element;
};

const pickedDot = (ctx: SystemsContext, body: Body): HTMLElement[] =>
    body.id === ctx.picked
        ? [
              h("span", {
                  class: "orrery__search-picked",
                  role: "img",
                  "aria-label": "Picked",
              }),
          ]
        : [];

/** A body's name in a sentence: "the Sun", or the name itself. */
export const named = (body: Body): string =>
    body.name === "Sun" ? "the Sun" : body.name;

const roleText = (body: Body): string =>
    body.role ? ROLE_LABELS[body.role].toLowerCase() : "";

const heading = (label: string, rows?: Group["rows"]): HTMLElement =>
    h(
        "div",
        { class: "orrery__search-group", role: "presentation" },
        label,
        ...(rows
            ? [h("span", {}, String(rows.filter((row) => !row.nested).length))]
            : []),
    );

const row = (
    ctx: SystemsContext,
    body: Body,
    options: RowOptions,
): HTMLElement => {
    const classes = ["orrery__search-row"];
    if (options.shown) classes.push("orrery__search-row--shown");
    if (options.nested) classes.push("orrery__search-row--nested");
    if (options.query !== undefined) classes.push("orrery__search-row--two");

    const name = h("span", { class: "orrery__search-name" });
    const [before, match, after] = marked(body.name, options.query ?? "");
    name.append(before);
    if (match) name.append(h("b", {}, match));
    name.append(after);

    const middle: HTMLElement[] = [];
    if (options.query === undefined) {
        // The left column is too narrow for both, and its Spacecraft heading says what they are.
        const role = options.pane === "left" ? "" : roleText(body);
        middle.push(name);
        if (role)
            middle.push(h("span", { class: "orrery__search-role" }, role));
    } else {
        const parent = ctx.bodies.find(
            (candidate) => candidate.id === body.parent,
        );
        const role = body.kind === "spacecraft" && body.role;
        const kind = role
            ? `${ROLE_LABELS[role]} craft`
            : KIND_LABELS[body.kind];
        const sub = h(
            "span",
            { class: "orrery__search-sub" },
            parent ? `${kind} around ${parent.name}` : kind,
        );
        middle.push(h("span", { class: "orrery__search-text" }, name, sub));
    }

    const item = h(
        "div",
        {
            role: "option",
            id: optionId(options.pane, body.id),
            class: classes.join(" "),
            "data-id": body.id,
            "aria-selected": String(options.active),
        },
        marker(body, "row"),
        ...middle,
        ...pickedDot(ctx, body),
        h("span", { class: "orrery__search-range" }, ctx.range(body.id)),
    );

    if (options.chevron) {
        const chevron = h("span", { class: "orrery__search-chevron" });
        chevron.innerHTML = CHEVRON;
        // The root's system is every body, which the right pane doesn't list.
        const opens =
            body.parent !== null && system(ctx.bodies, body.id).length > 0;
        chevron.style.visibility = opens ? "" : "hidden";
        item.append(chevron);
    }

    return item;
};

/** The root row, then the root's children by group, each with its system's chevron. */
export const leftRows = (
    ctx: SystemsContext,
    shown: string,
    active: string | null,
): HTMLElement[] => {
    const { root, groups } = leftPane(ctx.bodies);
    const options = (body: Body): RowOptions => ({
        pane: "left",
        active: body.id === active,
        shown: body.id === shown,
        chevron: true,
    });

    return [
        heading(KIND_LABELS[root.kind]),
        row(ctx, root, options(root)),
        ...groups.flatMap(({ label, rows }) => [
            heading(label, rows),
            ...rows.map(({ body }) => row(ctx, body, options(body))),
        ]),
    ];
};

/** The head of the right pane: the body, its facts and the buttons that pick it. */
export const headRows = (ctx: SystemsContext, body: Body): HTMLElement[] => {
    const title = h(
        "div",
        { class: "orrery__search-title" },
        marker(body, "head"),
        h("h2", {}, body.name),
        ...pickedDot(ctx, body),
        h("span", { class: "orrery__search-kind" }, KIND_LABELS[body.kind]),
        h("span", { class: "orrery__search-range" }, ctx.range(body.id)),
    );
    title.dataset.id = body.id;

    const { period, radius } = facts(ctx.bodies, body.id);
    const entries: [string, string][] = [];
    if (period !== null) entries.push(["Period", formatDuration(period)]);
    if (radius !== null) entries.push(["Mean radius", formatRadius(radius)]);

    const picked = body.id === ctx.picked;
    const buttons = h(
        "div",
        { class: "orrery__search-actions" },
        h(
            "button",
            {
                type: "button",
                class: "orrery__search-button orrery__search-button--pick",
                "data-act": "pick",
                ...(picked ? { disabled: "" } : {}),
            },
            picked ? "Picked" : `Pick ${body.name}`,
        ),
        h(
            "button",
            {
                type: "button",
                class: "orrery__search-button",
                "data-act": "focus",
            },
            "Focus camera",
        ),
    );

    return [
        title,
        ...(entries.length > 0
            ? [
                  h(
                      "dl",
                      { class: "orrery__search-facts" },
                      ...entries.map(([term, value]) =>
                          h("div", {}, h("dt", {}, term), h("dd", {}, value)),
                      ),
                  ),
              ]
            : []),
        buttons,
    ];
};

/** The list of the right pane: the system of `shown`, a note for the root or an empty state. */
export const systemRows = (
    ctx: SystemsContext,
    shown: Body,
    active: string | null,
): HTMLElement[] => {
    const { root } = leftPane(ctx.bodies);

    if (shown.id === root.id) {
        const count = ctx.bodies.filter(
            (body) => body.parent === root.id,
        ).length;

        return [
            h(
                "p",
                { class: "orrery__search-note" },
                `${count} ${count === 1 ? "body orbits" : "bodies orbit"} ${named(root)}. Pick one on the left, or type to search.`,
            ),
        ];
    }

    const groups = system(ctx.bodies, shown.id);
    if (groups.length === 0) {
        return [
            h(
                "div",
                { class: "orrery__search-nothing" },
                h("p", {}, `Nothing is tracked around ${shown.name}.`),
                h(
                    "button",
                    {
                        type: "button",
                        class: "orrery__search-button",
                        "data-act": "add-blank",
                    },
                    "Add a body…",
                ),
            ),
        ];
    }

    return groups.flatMap(({ label, rows }) => [
        heading(label, rows),
        ...rows.map(({ body, nested }) =>
            row(ctx, body, {
                pane: "right",
                active: body.id === active,
                nested,
            }),
        ),
    ]);
};

/** The rows of a query's matches, or the note that there are none. */
export const resultRows = (
    ctx: SystemsContext,
    hits: readonly Body[],
    query: string,
    active: string | null,
): HTMLElement[] =>
    hits.length > 0
        ? hits.map((body) =>
              row(ctx, body, {
                  pane: "hit",
                  active: body.id === active,
                  query,
              }),
          )
        : [
              h(
                  "p",
                  { class: "orrery__search-nomatch" },
                  `No body named “${query.trim()}”.`,
              ),
          ];
