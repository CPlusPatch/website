<script lang="ts">
import { type AUnit, NARROW_QUERY, type Units } from "@cpluspatch/render";
import { distanceOf, statesAt } from "@cpluspatch/sim";
import { flushSync, untrack } from "svelte";
import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";
import { found, treeOrder } from "../../search.ts";
import { getDocument, getView } from "../../state/context.ts";
import AddButton from "./AddButton.svelte";
import Field from "./Field.svelte";
import Hint from "./Hint.svelte";
import { SEARCH_ICON } from "./icons.ts";
import { keyResult } from "./keys.ts";
import { panelOffset } from "./layout.ts";
import {
    activeOptionOf,
    controlsOf,
    type Place,
    placeAtOpen,
    rangesFor,
    reconcile,
    rowIds,
    showPlace,
    widened,
} from "./nav.ts";
import { panelHost } from "./panel-host.ts";
import Results from "./Results.svelte";
import SystemsList from "./SystemsList.svelte";
import { more, updateMore } from "./scroll.ts";

type Props = {
    /** The `.orrery` element, which the panel is appended to. */
    root: HTMLElement;
    units: Units;
    /** Opens the Add body form, with `name` in its Name field. */
    openAdd: (name: string) => void;
};

/** How often the ranges are patched while the panel is open, in ms. */
const RANGE_MS = 250;

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
const searching = $derived(query.trim() !== "");
const hits = $derived(searching ? found(treeOrder(bodies), query) : []);
const resultsRange = $derived(
    rangesFor(
        distances,
        chosen,
        hits.map((hit) => hit.id),
    ),
);

// The ids of the options in the list the input drives.
const listed = $derived(rowIds(bodies, query, { shown, pane }));
const activeOption = $derived(
    activeOptionOf(listed, active, searching ? "hit" : pane),
);
// A note or empty state isn't an option, so its list stops being a listbox.
const resultsListed = $derived(!built || hits.length > 0);
const controls = $derived(controlsOf(listed, built, searching, pane));

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

const updateAllMore = () => {
    for (const scroller of [left, systemList, results]) updateMore(scroller);
};

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

    const offset = panelOffset(
        root.getBoundingClientRect(),
        toggle.getBoundingClientRect(),
        root.querySelector(".orrery__panel--top")?.getBoundingClientRect()
            .bottom,
        panel.offsetWidth,
    );
    panel.style.setProperty("--orrery-search-top", `${offset.top}px`);
    panel.style.setProperty("--orrery-search-left", `${offset.left}px`);

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
    const next = showPlace(bodies, place(), id, narrowQuery.matches);

    if (next) go(next);
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

// Narrow, the Add button slides away with the left pane,
// so the last button of the right pane is last.
const lastControl = () =>
    panes?.hasAttribute("data-detail")
        ? [...(right?.querySelectorAll("button:not(:disabled)") ?? [])].at(-1)
        : addButton;

const inputKeys: Attachment<HTMLInputElement> = (node) =>
    on(node, "keydown", (event) => {
        if (event.isComposing) return;

        const result = keyResult(event.key, event.shiftKey, {
            bodies,
            query,
            narrow: narrowQuery.matches,
            shown,
            pane,
            active,
        });
        if (!result) return;

        event.preventDefault();

        if (result.type === "go") go(result.place);
        else if (result.type === "pick") pick(result.id, result.andFocus);
        else if (result.type === "add") add();
        else if (result.type === "back") back();
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
        {@attach panelHost(root, lastControl, () => close(true))}
    >
        <Field
            {visible}
            {controls}
            {activeOption}
            bind:input
            oninput={onInput}
            keys={inputKeys}
        />
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
            <Results
                {bodies}
                {hits}
                {query}
                {active}
                picked={view.selected}
                {built}
                {searching}
                listed={resultsListed}
                range={resultsRange}
                bind:results
                {more}
                onpick={pick}
            />
            <AddButton {query} bind:button={addButton} onadd={add} />
        </div>
        <Hint {searching} />
    </section>
{/if}
