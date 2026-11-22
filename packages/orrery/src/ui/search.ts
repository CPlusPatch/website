import type { Body } from "@cpluspatch/orbit";
import { formatDistance } from "../format.ts";
import { readouts } from "../readouts.ts";
import { found, marked } from "../search.ts";
import type { Units } from "../units.ts";
import type { World } from "../world.ts";
import { showBodyMarker } from "./body-marker.ts";
import { h, setText } from "./dom.ts";

/** The search button, the combobox it opens and how to remove them. */
export type Search = {
    toggle: HTMLButtonElement;
    /** Opens the panel and focuses its input. */
    open: () => void;
    destroy: () => void;
};

/** How often the ranges are patched while the panel is open, in ms. */
const RANGE_MS = 250;

/** The panel's width in px, which the left edge is clamped with. */
const WIDTH = 320;

/** The gap in px between the panel and the edges of the root. */
const MARGIN = 8;

const SEARCH_ICON =
    '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="6.5" cy="6.5" r="4.5"/><path d="M10 10l4.5 4.5"/></g></svg>';
const PLUS_ICON =
    '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

const icon = (className: string, svg: string): HTMLElement => {
    const element = h("span", { class: className });
    element.innerHTML = svg;

    return element;
};

/**
 * A button for the top bar, and under it a combobox that lists every body, grouped by parent.
 * Picking a body selects it, and Shift focuses it. The first row adds a body with `openAdd`.
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
        "aria-controls": "orrery-search-list",
        "aria-autocomplete": "list",
        "aria-activedescendant": "",
        placeholder: "Find a body",
        autocomplete: "off",
        spellcheck: "false",
    });
    const empty = h("p", { class: "orrery__search-empty" });
    empty.hidden = true;
    const list = h("ul", {
        id: "orrery-search-list",
        class: "orrery__search-list",
        role: "listbox",
        "aria-label": "Bodies",
    });
    const hint = h("p", { class: "orrery__search-hint" });
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
        list,
        empty,
        hint,
    );
    panel.hidden = true;
    root.append(panel);

    let hits: Body[] = [];
    let active = 0;
    let timer: ReturnType<typeof setInterval> | undefined;

    const range = (id: string): string => {
        const current = readouts(
            world.scenario,
            id,
            world.states(),
            world.clock.t,
        );

        return current ? formatDistance(current.distance, units.get()) : "";
    };

    const row = (body: Body, query: string): HTMLElement => {
        const [before, match, after] = marked(body.name, query);
        const marker = h("span", { class: "orrery__search-marker" });
        showBodyMarker(marker, body);

        const name = h("span", { class: "orrery__search-name" }, before);
        if (match) name.append(h("b", {}, match));
        name.append(after);

        const parent = world.scenario.bodies.find((b) => b.id === body.parent);
        const text = h("span", { class: "orrery__search-text" }, name);
        if (parent) {
            text.append(
                h(
                    "span",
                    { class: "orrery__search-parent" },
                    `around ${parent.name}`,
                ),
            );
        }

        const item = h(
            "li",
            {
                role: "option",
                id: `orrery-search-body-${body.id}`,
                "data-id": body.id,
                "aria-selected": "false",
            },
            marker,
            text,
            h("span", { class: "orrery__search-range" }, range(body.id)),
        );
        if (body.id === world.selected) item.dataset.picked = "";

        return item;
    };

    const markActive = (scroll = true) => {
        const items = [...list.children];

        items.forEach((item, k) => {
            item.setAttribute("aria-selected", String(k === active));
        });

        const item = items[active];
        input.setAttribute("aria-activedescendant", item?.id ?? "");
        setText(
            hint,
            active === 0 ? "Enter adds." : "Enter picks. Shift+Enter focuses.",
        );
        if (scroll) item?.scrollIntoView({ block: "nearest" });
    };

    const render = () => {
        const query = input.value;
        const trimmed = query.trim();
        hits = found(world.order, query);

        const label =
            hits.length > 0 || !trimmed ? "Add a body…" : `Add “${trimmed}”`;
        const add = h(
            "li",
            {
                role: "option",
                id: "orrery-search-add",
                "data-add": "",
                "aria-selected": "false",
            },
            icon("orrery__search-marker", PLUS_ICON),
            h(
                "span",
                { class: "orrery__search-text" },
                h("span", { class: "orrery__search-name" }, label),
            ),
        );
        list.replaceChildren(add, ...hits.map((body) => row(body, query)));

        empty.hidden = hits.length > 0;
        setText(empty, `No body named “${trimmed}”.`);
        // The Add row is first, so the hits are rows 1 and up. With no hits it's the only row.
        active = Math.min(active, hits.length);
        markActive();
    };

    const patchRanges = () => {
        for (const item of list.querySelectorAll<HTMLElement>("li[data-id]")) {
            const id = item.dataset.id;
            const node = item.querySelector(".orrery__search-range");
            if (id && node) setText(node, range(id));
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
        const left = Math.max(
            MARGIN,
            Math.min(at.left, host.right - WIDTH - MARGIN),
        );
        panel.style.setProperty(
            "--orrery-search-top",
            `${(bar?.getBoundingClientRect().bottom ?? at.bottom) - host.top}px`,
        );
        panel.style.setProperty(
            "--orrery-search-left",
            `${left - host.left}px`,
        );

        input.value = "";
        active =
            world.order.findIndex((body) => body.id === world.selected) + 1 ||
            1;
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
    input.addEventListener(
        "blur",
        (event) => {
            const next = event.relatedTarget;
            if (!(next instanceof Node && panel.contains(next))) close(false);
        },
        { signal },
    );
    input.addEventListener(
        "input",
        () => {
            active = 1;
            render();
        },
        { signal },
    );
    input.addEventListener(
        "keydown",
        (event) => {
            if (event.isComposing) return;

            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();

                const step = event.key === "ArrowDown" ? 1 : -1;
                active = (active + step + hits.length + 1) % (hits.length + 1);
                markActive();
            } else if (event.key === "Enter") {
                event.preventDefault();

                const hit = hits[active - 1];
                if (hit) pick(hit.id, event.shiftKey);
                else add();
            } else if (event.key === "Escape") {
                event.preventDefault();
                close(true);
            }
        },
        { signal },
    );
    list.addEventListener(
        "click",
        (event) => {
            const item =
                event.target instanceof Element
                    ? event.target.closest("li")
                    : null;
            if (!item) return;

            if (item.dataset.id) pick(item.dataset.id, event.shiftKey);
            else add();
        },
        { signal },
    );
    list.addEventListener(
        "mousemove",
        (event) => {
            const item =
                event.target instanceof Element
                    ? event.target.closest("li")
                    : null;
            const k = item ? [...list.children].indexOf(item) : -1;

            if (k >= 0 && k !== active) {
                active = k;
                markActive(false);
            }
        },
        { signal },
    );

    return {
        toggle,
        open,
        destroy: () => {
            abort.abort();
            clearInterval(timer);
            toggle.remove();
            panel.remove();
        },
    };
};
