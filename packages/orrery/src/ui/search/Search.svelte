<script lang="ts">
import { type AUnit, NARROW_QUERY, type Units } from "@cpluspatch/render";
import { distanceOf, statesAt } from "@cpluspatch/sim";
import { flushSync, untrack } from "svelte";
import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";
import { found, treeOrder } from "../../search.ts";
import { getDocument, getView } from "../../state/context.ts";
import { leftPane } from "../../systems.ts";
import {
    firstOf,
    idsOf,
    optionId,
    type Place,
    placeAtOpen,
    RESULTS_HINT,
    rangesFor,
    reconcile,
    rowIds,
    step,
    systemIds,
    TREE_HINT,
    widened,
} from "./nav.ts";
import Row from "./Row.svelte";
import SystemsList from "./SystemsList.svelte";

type Props = {
    /** The `.orrery` element, which the panel is appended to. */
    root: HTMLElement;
    units: Units;
    /** Opens the Add body form, with `name` in its Name field. */
    openAdd: (name: string) => void;
};

/** How often the ranges are patched while the panel is open, in ms. */
const RANGE_MS = 250;

/** The gap in px between the panel and the edges of the root. */
const MARGIN = 8;

const SEARCH_ICON =
    '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="6.5" cy="6.5" r="4.5"/><path d="M10 10l4.5 4.5"/></g></svg>';
const PLUS_ICON =
    '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

const { root, units, openAdd }: Props = $props();

const documents = getDocument();
const view = getView();

const narrowQuery = matchMedia(NARROW_QUERY);

let toggle: HTMLButtonElement | undefined;
let panel = $state.raw<HTMLElement>();
let input = $state.raw<HTMLInputElement>();
let panes = $state.raw<HTMLElement>();
let results = $state.raw<HTMLElement>();
// It comes last in the panes so Tab reaches it after the pane's buttons. CSS places it.
let addButton = $state.raw<HTMLButtonElement>();
let left = $state.raw<HTMLElement>();
let systemList = $state.raw<HTMLElement>();
let right = $state.raw<HTMLElement>();

let visible = $state(false);
// The lists stay empty until the first open.
let built = $state(false);
let query = $state("");
/** The body whose system the right pane shows: the root or one of its children. */
let shown = $state("");
let pane = $state<"left" | "right">("left");
let active = $state<string | null>(null);
let narrow = $state(narrowQuery.matches);
/** Each body's distance to its parent, worked out on a render trigger and every `RANGE_MS`. */
let distances = $state.raw<ReadonlyMap<string, number | null>>(new Map());
let chosen = $state.raw<AUnit | null>(null);
let renderedShown = "";

const bodies = $derived(documents.presentBodies);
const { root: top, groups } = $derived(leftPane(bodies));
const searching = $derived(query.trim() !== "");
const hits = $derived(searching ? found(treeOrder(bodies), query) : []);
const body = $derived(
    bodies.find((candidate) => candidate.id === shown) ?? top,
);
const hint = $derived(searching ? RESULTS_HINT : TREE_HINT);
const resultsRange = $derived(
    rangesFor(
        distances,
        chosen,
        hits.map((hit) => hit.id),
    ),
);

// The ids of the options in the list the input drives.
const listed = $derived(
    searching
        ? hits.map((hit) => hit.id)
        : pane === "left"
          ? [top.id, ...idsOf(groups)]
          : systemIds(bodies, body.id),
);
const activeOption = $derived(
    active !== null && listed.includes(active)
        ? optionId(searching ? "hit" : pane, active)
        : "",
);
// A note or empty state isn't an option, so its list stops being a listbox.
const resultsListed = $derived(!built || hits.length > 0);
const controls = $derived.by((): string | undefined => {
    if (!built) return "orrery-search-left";
    if (searching) return hits.length > 0 ? "orrery-search-results" : undefined;
    if (pane === "left") return "orrery-search-left";

    return systemIds(bodies, body.id).length > 0
        ? "orrery-search-right"
        : undefined;
});

const place = (): Place => ({ shown, pane, active });

const go = (to: Place) => {
    shown = to.shown;
    pane = to.pane;
    active = to.active;
};

const measure = () => {
    const states = statesAt(documents.system, view.now());

    distances = new Map(
        bodies.map((candidate) => [
            candidate.id,
            distanceOf(states, candidate),
        ]),
    );
    chosen = units.get();
};

/** Fades the foot of a list while more rows are below. */
const updateMore = (list: HTMLElement | undefined) =>
    list?.toggleAttribute(
        "data-more",
        list.scrollTop + list.clientHeight < list.scrollHeight - 1,
    );

const updateAllMore = () => {
    for (const scroller of [left, systemList, results]) updateMore(scroller);
};

const more: Attachment<HTMLElement> = (node) =>
    on(node, "scroll", () => updateMore(node), { passive: true });

const close = (back: boolean) => {
    if (!visible) return;

    visible = false;
    if (back) toggle?.focus();
};

/** Opens the panel and focuses its input. */
export const open = (): void => {
    if (visible || !toggle || !panel || !input) return;

    visible = true;
    // Measuring and focusing need the panel shown.
    flushSync();

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

    input.value = "";
    query = "";
    go(placeAtOpen(bodies, view.selected));
    renderedShown = "";
    narrow = narrowQuery.matches;
    built = true;
    measure();
    flushSync();
    afterRender();
    input.focus();
};

/** Focuses the search button. */
export const focusToggle = (): void => toggle?.focus();

const pick = (id: string, andFocus: boolean) => {
    close(true);
    // The rows aren't rebuilt while open, so the body may be gone.
    if (!bodies.some((candidate) => candidate.id === id)) return;

    view.select(id);
    if (andFocus) view.setFocus(id);
};

const add = () => {
    const name = query.trim();

    close(false);
    openAdd(name);
};

const showSystem = (id: string) => {
    if (narrowQuery.matches) {
        // It slides over even with nothing to list, so the head can pick the body.
        shown = id;
        pane = "right";
        active = firstOf(bodies, id);

        return;
    }

    // Rebuilding would detach the clicked row, so its dblclick would never reach the list.
    if (id === shown && id === active && pane === "left") return;

    shown = active = id;
    pane = "left";
};

const back = () => {
    pane = "left";
    active = shown;
    input?.focus();
};

const act = (name: "pick" | "focus" | "back" | "add-blank") => {
    if (name === "add-blank") {
        close(false);
        openAdd("");
    } else if (name === "pick") pick(shown, false);
    else if (name === "focus") pick(shown, true);
    else back();
};

// A focused button that is removed would blur with no target and close the panel.
$effect.pre(() => {
    void [query, shown, pane, active, documents.doc];

    untrack(() => {
        const focused = document.activeElement;
        if (visible && focused !== input && panel?.contains(focused)) {
            input?.focus();
        }
    });
});

// The scenario can change under an open panel.
$effect.pre(() => {
    void documents.doc;

    untrack(() => {
        if (!visible) return;

        measure();
        go(reconcile(bodies, place(), query));
    });
});

/** Scrolls the active row into view and resets the scroll of a new system, after a render. */
const afterRender = () => {
    // Narrow, the whole right pane scrolls rather than its list.
    if (!searching) {
        if (renderedShown !== shown && systemList && right) {
            systemList.scrollTop = 0;
            right.scrollTop = 0;
        }
        renderedShown = shown;
    }

    if (activeOption) {
        document
            .getElementById(activeOption)
            ?.scrollIntoView({ block: "nearest" });
    }
    updateAllMore();
};

$effect(() => {
    void [visible, bodies, query, shown, pane, active, narrow];

    untrack(() => {
        if (visible) afterRender();
    });
});

$effect(() => {
    if (!visible) return;

    const timer = setInterval(() => {
        measure();
        updateAllMore();
    }, RANGE_MS);

    return () => clearInterval(timer);
});

// Turning the screen moves the right pane in or out of the slide-over.
$effect(() =>
    on(narrowQuery, "change", () => {
        if (!visible) return;

        narrow = narrowQuery.matches;
        // Wide, the right pane needs an active row to be there at all.
        if (!narrowQuery.matches) go(widened(place()));
    }),
);

// The panel must cover the scene without moving the label band, and the CSS positions it
// against the root, so it can't stay in the top bar.
// The keys are native: a delegated handler would run after the shortcuts on the document.
const panelHost: Attachment<HTMLElement> = (node) => {
    root.append(node);

    const off = on(node, "keydown", (event) => {
        // Tab past the last control lands where Escape does, not on the page body.
        // Narrow, the Add button slides away with the left pane,
        // so the last button of the right pane is last.
        const last = panes?.hasAttribute("data-detail")
            ? [...(right?.querySelectorAll("button:not(:disabled)") ?? [])].at(
                  -1,
              )
            : addButton;
        const leaving =
            event.key === "Tab" && !event.shiftKey && event.target === last;
        if (event.key === "Escape" || leaving) {
            event.preventDefault();
            close(true);
        }
    });

    return () => {
        off();
        node.remove();
    };
};

const inputKeys: Attachment<HTMLInputElement> = (node) =>
    on(node, "keydown", (event) => {
        if (event.isComposing) return;

        const { key } = event;

        if (
            key === "ArrowDown" ||
            key === "ArrowUp" ||
            // In a query they move the caret.
            ((key === "Home" || key === "End") && !searching)
        ) {
            event.preventDefault();

            const next = step(
                rowIds(bodies, query, { shown, pane }),
                active,
                key,
            );
            if (next === undefined) return;

            active = next;
            if (pane === "left" && !searching && active) shown = active;
        } else if (key === "Enter") {
            event.preventDefault();

            if (active) pick(active, event.shiftKey);
            else if (searching) add();
            else if (pane === "right") pick(shown, event.shiftKey);
        } else if (!searching) {
            // With a query, the caret keeps Left and Right.
            if (key === "ArrowRight" && pane === "left") {
                event.preventDefault();

                const first = firstOf(bodies, shown);
                if (first || narrowQuery.matches) {
                    pane = "right";
                    active = first;
                }
            } else if (key === "ArrowLeft" && pane === "right") {
                event.preventDefault();
                back();
            }
        }
    });

// Pressing the button or a row would blur the input, and close the panel.
const onToggleDown = (event: PointerEvent) => {
    if (visible) event.preventDefault();
};

const onPanelDown = (event: PointerEvent) => {
    if (event.target !== input) event.preventDefault();
};

const onFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (!(next instanceof Node && panel?.contains(next))) close(false);
};

const onInput = () => {
    query = input?.value ?? "";

    if (searching) {
        active = hits[0]?.id ?? null;
    } else {
        pane = "left";
        active = shown;
    }
};
</script>

<button
    type="button"
    class="orrery__tool"
    aria-label="Search"
    aria-haspopup="listbox"
    aria-expanded={visible}
    aria-controls="orrery-search"
    aria-keyshortcuts="/"
    bind:this={toggle}
    onpointerdown={onToggleDown}
    onclick={() => (visible ? close(true) : open())}
>
    <span class="orrery__tool-icon">{@html SEARCH_ICON}</span>
    <span class="orrery__tool-label" aria-hidden="true">Search</span>
    <kbd class="orrery__tool-key" aria-hidden="true">/</kbd>
</button>
{#if true}
    <!-- Unmount removes this block, not the panel the attachment moved. -->
    <!-- A button reached with Tab keeps the panel open, and leaving the panel closes it. -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <section
        id="orrery-search"
        class="orrery__search"
        aria-label="Search bodies"
        hidden={!visible}
        bind:this={panel}
        onpointerdown={onPanelDown}
        onfocusout={onFocusOut}
        {@attach panelHost}
    >
        <div class="orrery__search-field">
            <span class="orrery__search-icon">{@html SEARCH_ICON}</span>
            <input
                type="text"
                role="combobox"
                aria-label="Find a body"
                aria-expanded={visible}
                aria-controls={controls}
                aria-autocomplete="list"
                aria-activedescendant={activeOption}
                placeholder="Find a body"
                autocomplete="off"
                spellcheck="false"
                bind:this={input}
                oninput={onInput}
                {@attach inputKeys}
            >
        </div>
        <div
            class="orrery__search-panes"
            data-mode={searching ? "results" : "tree"}
            data-detail={narrow && !searching && pane === "right"
                ? ""
                : undefined}
            bind:this={panes}
        >
            <SystemsList
                {bodies}
                {shown}
                {pane}
                {active}
                {narrow}
                picked={view.selected}
                {chosen}
                {distances}
                {built}
                {searching}
                bind:left
                bind:systemList
                bind:right
                {more}
                onshow={showSystem}
                onpick={pick}
                ondouble={(id) => {
                    if (!narrowQuery.matches) pick(id, false);
                }}
                onact={act}
            />
            <!-- biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is on only while the list holds an option -->
            <div
                id="orrery-search-results"
                class="orrery__search-results"
                tabindex="-1"
                role={resultsListed ? "listbox" : undefined}
                aria-label={resultsListed ? "Matching bodies" : undefined}
                bind:this={results}
                {@attach more}
            >
                {#if built && searching}
                    {#each hits as hit (hit.id)}
                        <Row
                            body={hit}
                            {bodies}
                            pane="hit"
                            active={hit.id === active}
                            {query}
                            picked={hit.id === view.selected}
                            range={resultsRange(hit.id)}
                            onrow={(event) => pick(hit.id, event.shiftKey)}
                        />
                    {:else}
                        <p class="orrery__search-nomatch">
                            No body named “{query.trim()}”.
                        </p>
                    {/each}
                {/if}
            </div>
            <button
                type="button"
                class="orrery__search-add"
                data-act="add"
                bind:this={addButton}
                onclick={add}
            >
                <span class="orrery__search-add-icon">{@html PLUS_ICON}</span>
                <span
                    >{searching ? `Add “${query.trim()}”` : "Add a body…"}</span
                >
            </button>
        </div>
        <p class="orrery__search-hint">
            {#each hint as [symbol, label, action], index (symbol)}
                {#if index > 0}
                    <span class="orrery__search-sep" aria-hidden="true">·</span>
                {/if}
                <span class="orrery__search-keyhint">
                    <kbd class="orrery__search-key" aria-label={label}
                        >{symbol}</kbd
                    >
                    {action}
                </span>
            {/each}
        </p>
    </section>
{/if}
