import type { Body } from "@cpluspatch/orbit";
import type { AUnit } from "../editing.ts";
import { formatRange, listUnit } from "../format.ts";
import { distanceOf } from "../readouts.ts";
import { found, treeOrder } from "../search.ts";
import { leftPane, system } from "../systems.ts";
import type { Units } from "../units.ts";
import type { World } from "../world.ts";
import { h, NARROW_QUERY, setText } from "./dom.ts";
import {
    headRows,
    leftRows,
    named,
    railRows,
    resultRows,
    type SystemsContext,
    systemRows,
} from "./systems-view.ts";

/** The search button, the Systems panel it opens and how to remove them. */
export type Search = {
    toggle: HTMLButtonElement;
    /** Opens the panel and focuses its input. */
    open: () => void;
    destroy: () => void;
};

/** How often the ranges are patched while the panel is open, in ms. */
const RANGE_MS = 250;

/** The gap in px between the panel and the edges of the root. */
const MARGIN = 8;

const SEARCH_ICON =
    '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="6.5" cy="6.5" r="4.5"/><path d="M10 10l4.5 4.5"/></g></svg>';
const BACK_ICON =
    '<svg viewBox="0 0 8 12" aria-hidden="true" focusable="false"><path d="M6.5 1.5 1.5 6l5 4.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
const PLUS_ICON =
    '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

/** The keys of the hint: the symbols, what a screen reader says for them and the action. */
type HintKey = [symbol: string, label: string, action: string];

const UP_DOWN: HintKey = ["↑↓", "Up and Down", "move"];
const PICK: HintKey = ["↵", "Enter", "pick"];
const FOCUS: HintKey = ["⇧↵", "Shift+Enter", "focus"];
const CLOSE: HintKey = ["esc", "Escape", "close"];
const TREE_HINT: HintKey[] = [
    UP_DOWN,
    ["→", "Right", "open"],
    ["←", "Left", "back"],
    PICK,
    FOCUS,
    CLOSE,
];
const RESULTS_HINT: HintKey[] = [UP_DOWN, PICK, FOCUS, CLOSE];

/** The ids of the rows of `groups`, top to bottom. */
const idsOf = (groups: ReturnType<typeof system>): string[] =>
    groups.flatMap((group) => group.rows.map((row) => row.body.id));

const hintNodes = (keys: HintKey[]): HTMLElement[] =>
    keys.flatMap(([symbol, label, action], index) => [
        ...(index > 0
            ? [
                  h(
                      "span",
                      { class: "orrery__search-sep", "aria-hidden": "true" },
                      "·",
                  ),
              ]
            : []),
        h(
            "span",
            { class: "orrery__search-keyhint" },
            h(
                "kbd",
                { class: "orrery__search-key", "aria-label": label },
                symbol,
            ),
            action,
        ),
    ]);

const icon = (className: string, svg: string): HTMLElement => {
    const element = h("span", { class: className });
    element.innerHTML = svg;

    return element;
};

/**
 * A button for the top bar, and under it a two-pane panel: the root and its children on the
 * left, the system of one of them on the right. Typing a query lists matches from every system.
 * Picking a body selects it, and Shift focuses it. The Add button opens the form with `openAdd`.
 */
export const createSearch = (
    root: HTMLElement,
    world: World,
    units: Units,
    /** Opens the Add body form, with `name` in its Name field. */
    openAdd: (name: string) => void,
): Search => {
    const abort = new AbortController();
    const { signal } = abort;

    const toggle = h(
        "button",
        {
            type: "button",
            class: "orrery__tool",
            "aria-label": "Search",
            "aria-haspopup": "listbox",
            "aria-expanded": "false",
            "aria-controls": "orrery-search",
            "aria-keyshortcuts": "/",
        },
        icon("orrery__tool-icon", SEARCH_ICON),
        h(
            "span",
            { class: "orrery__tool-label", "aria-hidden": "true" },
            "Search",
        ),
        h("kbd", { class: "orrery__tool-key", "aria-hidden": "true" }, "/"),
    );

    const input = h("input", {
        type: "text",
        role: "combobox",
        "aria-label": "Find a body",
        "aria-expanded": "false",
        "aria-controls": "orrery-search-left",
        "aria-autocomplete": "list",
        "aria-activedescendant": "",
        placeholder: "Find a body",
        autocomplete: "off",
        spellcheck: "false",
    });
    const addLabel = h("span", {}, "Add a body…");
    const addButton = h(
        "button",
        { type: "button", class: "orrery__search-add", "data-act": "add" },
        icon("orrery__search-add-icon", PLUS_ICON),
        addLabel,
    );
    const backLabel = h("span");
    const backButton = h(
        "button",
        { type: "button", class: "orrery__search-back", "data-act": "back" },
        icon("orrery__search-back-icon", BACK_ICON),
        backLabel,
    );
    // Scrollable lists would otherwise take a Tab stop of their own.
    const left = h("div", {
        id: "orrery-search-left",
        class: "orrery__search-left",
        tabindex: "-1",
        role: "listbox",
    });
    const head = h("div", { class: "orrery__search-head" });
    // The rows of the rail say the same, so a screen reader skips it.
    const rail = h("div", {
        class: "orrery__search-rail",
        "aria-hidden": "true",
    });
    rail.hidden = true;
    const systemList = h("div", {
        id: "orrery-search-right",
        class: "orrery__search-system",
        tabindex: "-1",
        role: "listbox",
    });
    const results = h("div", {
        id: "orrery-search-results",
        class: "orrery__search-results",
        tabindex: "-1",
        role: "listbox",
        "aria-label": "Matching bodies",
    });
    /** Each list's label, put back when it holds options again. */
    const labels = new Map<HTMLElement, string>([[results, "Matching bodies"]]);
    const right = h(
        "div",
        { class: "orrery__search-right" },
        backButton,
        head,
        rail,
        systemList,
    );
    // The Add button comes last so Tab reaches it after the pane's buttons. CSS places it.
    const panes = h(
        "div",
        { class: "orrery__search-panes", "data-mode": "tree" },
        left,
        right,
        results,
        addButton,
    );
    const treeHint = hintNodes(TREE_HINT);
    const resultsHint = hintNodes(RESULTS_HINT);
    const hint = h("p", { class: "orrery__search-hint" }, ...treeHint);
    const panel = h(
        "section",
        {
            id: "orrery-search",
            class: "orrery__search",
            "aria-label": "Search bodies",
        },
        h(
            "div",
            { class: "orrery__search-field" },
            icon("orrery__search-icon", SEARCH_ICON),
            input,
        ),
        panes,
        hint,
    );
    panel.hidden = true;
    root.append(panel);

    const narrow = matchMedia(NARROW_QUERY);
    /** The body whose system the right pane shows: the root or one of its children. */
    let shown = "";
    let pane: "left" | "right" = "left";
    let active: string | null = null;
    let hits: Body[] = [];
    let renderedShown = "";
    let timer: ReturnType<typeof setInterval> | undefined;

    const searching = (): boolean => input.value.trim() !== "";

    /** Each body's distance to its parent, worked out once per render or patch. */
    let distances = new Map<string, number | null>();

    const measure = () => {
        const states = world.states();

        distances = new Map(
            world.scenario.bodies.map((body) => [
                body.id,
                distanceOf(states, body),
            ]),
        );
    };

    const distance = (id: string): number | null => distances.get(id) ?? null;

    /** The unit all of one list's rows share. */
    const unitOf = (ids: readonly string[]): AUnit =>
        listUnit(
            ids.flatMap((id) => distance(id) ?? []),
            units.get(),
        );

    const rangeIn =
        (unit: AUnit) =>
        (id: string): string => {
            const metres = distance(id);

            return metres === null ? "" : formatRange(metres, unit);
        };

    const contextFor = (
        bodies: readonly Body[],
        ids: readonly string[],
    ): SystemsContext => ({
        bodies,
        picked: world.selected,
        range: rangeIn(unitOf(ids)),
    });

    /** Fades the foot of a list while more rows are below. */
    const updateMore = (list: HTMLElement) =>
        list.toggleAttribute(
            "data-more",
            list.scrollTop + list.clientHeight < list.scrollHeight - 1,
        );

    const matches = (): Body[] =>
        found(treeOrder(world.scenario.bodies), input.value);

    /** The first row of the right pane for `id`. The root has none, since the pane shows a note. */
    const firstOf = (id: string): string | null =>
        id === leftPane(world.scenario.bodies).root.id
            ? null
            : (system(world.scenario.bodies, id)[0]?.rows[0]?.body.id ?? null);

    /** The ids of the rows the arrow keys move through, top to bottom. */
    const rowIds = (): string[] => {
        const bodies = world.scenario.bodies;
        if (searching()) return hits.map((body) => body.id);
        if (pane === "left") {
            const { root: top, groups } = leftPane(bodies);

            return [top.id, ...idsOf(groups)];
        }

        return bodies.some((body) => body.id === shown)
            ? idsOf(system(bodies, shown))
            : [];
    };

    const render = () => {
        // A focused button that replaceChildren removes would blur with no target and close the panel.
        if (
            panel.contains(document.activeElement) &&
            document.activeElement !== input
        ) {
            input.focus();
        }

        measure();

        const bodies = world.scenario.bodies;
        const { root: top } = leftPane(bodies);
        const query = input.value;
        const trimmed = query.trim();
        const inResults = trimmed !== "";

        // The scenario can change under an open panel.
        if (!bodies.some((body) => body.id === shown)) {
            shown = top.id;
            if (!inResults) {
                pane = "left";
                active = shown;
            }
        }

        if (active !== null && !bodies.some((body) => body.id === active)) {
            pane = "left";
            active = inResults ? null : shown;
        }

        hits = inResults ? matches() : [];
        if (inResults && !hits.some((hit) => hit.id === active)) {
            active = hits[0]?.id ?? null;
        }

        const body = bodies.find((candidate) => candidate.id === shown) ?? top;

        panes.dataset.mode = inResults ? "results" : "tree";
        panes.toggleAttribute(
            "data-detail",
            narrow.matches && !inResults && pane === "right",
        );
        setText(backLabel, `Bodies around ${named(top)}`);
        backButton.setAttribute(
            "aria-label",
            `Back to bodies around ${named(top)}`,
        );
        setText(addLabel, inResults ? `Add “${trimmed}”` : "Add a body…");
        hint.replaceChildren(...(inResults ? resultsHint : treeHint));

        if (inResults) {
            const context = contextFor(
                bodies,
                hits.map((hit) => hit.id),
            );
            results.replaceChildren(
                ...resultRows(context, hits, query, active),
            );
            // Rows from another mode or scenario would keep ids that no longer exist.
            left.replaceChildren();
            head.replaceChildren();
            rail.replaceChildren();
            rail.hidden = true;
            systemList.replaceChildren();
        } else {
            results.replaceChildren();

            const { groups } = leftPane(bodies);
            const leftContext = contextFor(bodies, [top.id, ...idsOf(groups)]);
            const systemContext = contextFor(
                bodies,
                idsOf(system(bodies, body.id)),
            );
            left.setAttribute("aria-label", `Bodies around ${named(top)}`);
            left.replaceChildren(
                ...leftRows(
                    leftContext,
                    shown,
                    pane === "left" ? active : null,
                ),
            );
            head.replaceChildren(
                ...headRows(contextFor(bodies, [body.id]), body),
            );
            const railContent = railRows(
                systemContext,
                body,
                pane === "right" ? active : null,
                units.get(),
            );
            rail.replaceChildren(...railContent);
            rail.hidden = railContent.length === 0;
            labels.set(systemList, `Bodies around ${named(body)}`);
            systemList.replaceChildren(
                ...systemRows(
                    systemContext,
                    body,
                    pane === "right" ? active : null,
                    narrow.matches,
                ),
            );
            // Narrow, the whole right pane scrolls rather than its list.
            if (renderedShown !== shown) {
                systemList.scrollTop = 0;
                right.scrollTop = 0;
            }
            renderedShown = shown;
        }

        // A note or empty state isn't an option, so its list stops being a listbox.
        for (const list of [results, systemList]) {
            if (list.querySelector('[role="option"]')) {
                list.setAttribute("role", "listbox");
                list.setAttribute("aria-label", labels.get(list) ?? "");
            } else {
                // ARIA doesn't allow a label on an element with no role.
                list.removeAttribute("role");
                list.removeAttribute("aria-label");
            }
        }

        const list = inResults ? results : pane === "left" ? left : systemList;
        const item = active
            ? list.querySelector<HTMLElement>(
                  `[role="option"][data-id="${CSS.escape(active)}"]`,
              )
            : null;

        if (list.hasAttribute("role")) {
            input.setAttribute("aria-controls", list.id);
        } else {
            input.removeAttribute("aria-controls");
        }
        input.setAttribute("aria-activedescendant", item?.id ?? "");
        item?.scrollIntoView({ block: "nearest" });

        for (const scroller of [left, systemList, results]) {
            updateMore(scroller);
        }
    };

    const patchRanges = () => {
        measure();

        for (const list of [left, head, systemList, results]) {
            const items = [...list.querySelectorAll<HTMLElement>("[data-id]")];
            const range = rangeIn(
                unitOf(items.flatMap((item) => item.dataset.id ?? [])),
            );

            for (const item of items) {
                const id = item.dataset.id;
                const node = item.querySelector(".orrery__search-range");
                if (id && node) setText(node, range(id));
            }
        }

        for (const scroller of [left, systemList, results]) {
            updateMore(scroller);
        }
    };

    const close = (back: boolean) => {
        if (panel.hidden) return;

        panel.hidden = true;
        clearInterval(timer);
        timer = undefined;
        toggle.setAttribute("aria-expanded", "false");
        input.setAttribute("aria-expanded", "false");
        if (back) toggle.focus();
    };

    const open = () => {
        if (!panel.hidden) return;

        panel.hidden = false;

        const host = root.getBoundingClientRect();
        const bar = root.querySelector(".orrery__panel--top");
        const at = toggle.getBoundingClientRect();
        const leftEdge = Math.max(
            MARGIN,
            Math.min(at.left, host.right - panel.offsetWidth - MARGIN),
        );
        panel.style.setProperty(
            "--orrery-search-top",
            `${(bar?.getBoundingClientRect().bottom ?? at.bottom) - host.top}px`,
        );
        panel.style.setProperty(
            "--orrery-search-left",
            `${leftEdge - host.left}px`,
        );

        const bodies = world.scenario.bodies;
        const { root: top } = leftPane(bodies);
        const picked = bodies.find((body) => body.id === world.selected);

        input.value = "";
        if (!picked || picked.id === top.id || picked.parent === top.id) {
            shown = active = picked?.id ?? top.id;
            pane = "left";
        } else {
            // Walk up to the child of the root that the picked body orbits.
            let ancestor: Body = picked;
            while (ancestor.parent !== top.id) {
                const next = bodies.find((body) => body.id === ancestor.parent);
                if (!next) break;

                ancestor = next;
            }

            shown = ancestor.parent === top.id ? ancestor.id : top.id;
            pane = shown === top.id ? "left" : "right";
            active = pane === "left" ? shown : picked.id;
        }

        renderedShown = "";
        render();
        timer = setInterval(patchRanges, RANGE_MS);
        toggle.setAttribute("aria-expanded", "true");
        input.setAttribute("aria-expanded", "true");
        input.focus();
    };

    const pick = (id: string, andFocus: boolean) => {
        close(true);
        // The rows aren't rebuilt while open, so the body may be gone.
        if (!world.scenario.bodies.some((body) => body.id === id)) return;

        world.select(id);
        if (andFocus) world.focus(id);
    };

    const add = () => {
        const name = input.value.trim();

        close(false);
        openAdd(name);
    };

    const showSystem = (id: string) => {
        if (narrow.matches) {
            // It slides over even with nothing to list, so the head can pick the body.
            shown = id;
            pane = "right";
            active = firstOf(id);
            render();

            return;
        }

        // Rebuilding would detach the clicked row, so its dblclick would never reach the list.
        if (id === shown && id === active && pane === "left") return;

        shown = active = id;
        pane = "left";
        render();
    };

    const back = () => {
        pane = "left";
        active = shown;
        render();
        input.focus();
    };

    const unsubscribe = world.on((event) => {
        if (
            (event.type === "scenario" || event.type === "bodies") &&
            !panel.hidden
        ) {
            render();
        }
    });

    // Pressing the button or a row would blur the input, and close the panel.
    toggle.addEventListener(
        "pointerdown",
        (event) => {
            if (!panel.hidden) event.preventDefault();
        },
        { signal },
    );
    toggle.addEventListener(
        "click",
        () => (panel.hidden ? open() : close(true)),
        { signal },
    );
    panel.addEventListener(
        "pointerdown",
        (event) => {
            if (event.target !== input) event.preventDefault();
        },
        { signal },
    );
    // A button reached with Tab keeps the panel open, and leaving the panel closes it.
    panel.addEventListener(
        "focusout",
        (event) => {
            const next = event.relatedTarget;
            if (!(next instanceof Node && panel.contains(next))) close(false);
        },
        { signal },
    );
    panel.addEventListener(
        "keydown",
        (event) => {
            // Tab past the last control lands where Escape does, not on the page body.
            // Narrow, the Add button slides away with the left pane, so the last right-pane button is last.
            const last = panes.hasAttribute("data-detail")
                ? [...right.querySelectorAll("button:not(:disabled)")].at(-1)
                : addButton;
            const leaving =
                event.key === "Tab" && !event.shiftKey && event.target === last;
            if (event.key === "Escape" || leaving) {
                event.preventDefault();
                close(true);
            }
        },
        { signal },
    );
    input.addEventListener(
        "input",
        () => {
            if (searching()) {
                active = matches()[0]?.id ?? null;
            } else {
                pane = "left";
                active = shown;
            }
            render();
        },
        { signal },
    );
    input.addEventListener(
        "keydown",
        (event) => {
            if (event.isComposing) return;

            const { key } = event;

            if (
                key === "ArrowDown" ||
                key === "ArrowUp" ||
                // In a query they move the caret.
                ((key === "Home" || key === "End") && !searching())
            ) {
                event.preventDefault();

                const ids = rowIds();
                if (ids.length === 0) return;

                const at = active === null ? -1 : ids.indexOf(active);
                const next =
                    key === "Home"
                        ? 0
                        : key === "End"
                          ? ids.length - 1
                          : Math.min(
                                ids.length - 1,
                                Math.max(
                                    0,
                                    at + (key === "ArrowDown" ? 1 : -1),
                                ),
                            );

                active = ids[next] ?? null;
                if (pane === "left" && !searching() && active) shown = active;
                render();
            } else if (key === "Enter") {
                event.preventDefault();

                if (active) pick(active, event.shiftKey);
                else if (searching()) add();
                else if (pane === "right") pick(shown, event.shiftKey);
            } else if (!searching()) {
                // With a query, the caret keeps Left and Right.
                if (key === "ArrowRight" && pane === "left") {
                    event.preventDefault();

                    const first = firstOf(shown);
                    if (first || narrow.matches) {
                        pane = "right";
                        active = first;
                        render();
                    }
                } else if (key === "ArrowLeft" && pane === "right") {
                    event.preventDefault();
                    back();
                }
            }
        },
        { signal },
    );
    panel.addEventListener(
        "click",
        (event) => {
            const target =
                event.target instanceof Element ? event.target : null;
            const action =
                target?.closest<HTMLElement>("[data-act]")?.dataset.act;

            if (action === "add") add();
            else if (action === "add-blank") {
                close(false);
                openAdd("");
            } else if (action === "pick") pick(shown, false);
            else if (action === "focus") pick(shown, true);
            else if (action === "back") back();

            const item = target?.closest<HTMLElement>('[role="option"]');
            const id = item?.dataset.id;
            if (action || !id) return;

            if (item.parentElement === left) showSystem(id);
            else pick(id, event.shiftKey);
        },
        { signal },
    );
    for (const scroller of [left, systemList, results]) {
        scroller.addEventListener("scroll", () => updateMore(scroller), {
            passive: true,
            signal,
        });
    }
    left.addEventListener(
        "dblclick",
        (event) => {
            const id =
                event.target instanceof Element
                    ? event.target.closest<HTMLElement>('[role="option"]')
                          ?.dataset.id
                    : undefined;
            if (id && !narrow.matches) pick(id, false);
        },
        { signal },
    );
    // Turning the screen moves the right pane in or out of the slide-over.
    narrow.addEventListener(
        "change",
        () => {
            if (panel.hidden) return;

            // Wide, the right pane needs an active row to be there at all.
            if (!narrow.matches && pane === "right" && active === null) {
                pane = "left";
                active = shown;
            }
            render();
        },
        { signal },
    );

    return {
        toggle,
        open,
        destroy: () => {
            abort.abort();
            unsubscribe();
            clearInterval(timer);
            toggle.remove();
            panel.remove();
        },
    };
};
