<script module lang="ts">
/** How often the readouts refresh while the clock runs, in ms. */
const REFRESH_MS = 250;
</script>

<script lang="ts">
import type { EditScene, Units } from "@cpluspatch/render";
import { cardClasses } from "@cpluspatch/ui/components/card.ts";
import { tick, untrack } from "svelte";
import { getDocument, getView } from "../../state/context.ts";
import BurnEditor from "../BurnEditor.svelte";
import BodyAdder from "../body-adder/BodyAdder.svelte";
import ElementEditor from "../ElementEditor.svelte";
import Actions from "./Actions.svelte";
import Children from "./Children.svelte";
import Grip from "./Grip.svelte";
import Head from "./Head.svelte";
import Headline from "./Headline.svelte";
import { type Live, liveAt } from "./live.ts";
import Maneuvers from "./Maneuvers.svelte";
import type { Mode } from "./mode.ts";
import Plate from "./Plate.svelte";
import Stats from "./Stats.svelte";

type Props = {
    units: Units;
    /** Takes keyboard focus when the inspector hides while it holds it. */
    restoreFocus: (id: string) => void;
    /** What the editors draw in the scene. */
    scene: EditScene;
};

const { units, restoreFocus, scene }: Props = $props();

const documents = getDocument();
const view = getView();

let card = $state<HTMLElement>();
let content: HTMLElement | undefined;
let head = $state.raw<ReturnType<typeof Head>>();
let actions = $state.raw<ReturnType<typeof Actions>>();
let editor = $state.raw<ReturnType<typeof ElementEditor>>();
let burn = $state.raw<ReturnType<typeof BurnEditor>>();
let adder = $state.raw<ReturnType<typeof BodyAdder>>();

let mode = $state<Mode>("card");
let addName = $state("");
// On a phone the card is a sheet. It starts peeked and keeps its state across bodies.
let open = $state(false);
let live = $state.raw<Live>({
    current: null,
    unit: null,
    plate: null,
    t: 0,
});

const body = $derived(
    documents.doc.scenario.bodies.find(
        (candidate) => candidate.id === view.selected,
    ),
);
const parent = $derived(
    documents.doc.scenario.bodies.find(
        (candidate) => candidate.id === body?.orbit?.parent,
    ),
);
const hasOrbit = $derived(parent !== undefined && body?.orbit !== undefined);
const adding = $derived(mode === "add");

const refresh = () => {
    if (mode === "burn") burn?.refresh();
    // A form that draws its draft in the plate.
    const form = mode === "edit" ? editor : mode === "burn" ? burn : undefined;

    const id = view.selected;
    if (!id) return;

    live = liveAt(documents, id, view.now(), units.get(), form);
};

const focusFirst = () => {
    const next =
        card?.querySelector<HTMLElement>(
            "li:not([hidden]) > .orrery__orbit-chip",
        ) ?? card?.querySelector<HTMLElement>(".orrery__orbit-link");
    if (next) next.focus();
    else head?.focusClose();
};

// Back to the card, or nothing, with the focus on the search button.
const cancelAdd = () => {
    mode = "card";
    restoreFocus(view.selected ?? view.focus);
};

/** Shows the Add body form, with `name` in its Name field if one is given. */
export const openAdd = (name = "") => {
    if (mode === "add" && adder) {
        if (name !== "") adder.setName(name);
        adder.focus();

        return;
    }

    addName = name;
    mode = "add";
    void tick().then(() => adder?.focus());
};

// Back to the card, with focus on the button that opened the form.
const closeForm = async (opener: "edit" | "burn") => {
    mode = "card";
    await tick();
    actions?.focusOpener(opener);
};

/** Drops an open form's draft, as undo and redo change the document it was taken from. */
export const closeForms = async () => {
    if (mode === "card") return;

    const opener = mode;
    // Focus outside the form, like on the Undo button, stays where it is.
    const held = content?.contains(document.activeElement) === true;
    mode = "card";
    if (!held) return;

    if (opener === "add") {
        restoreFocus(view.selected ?? view.focus);

        return;
    }

    await tick();
    actions?.focusOpener(opener);
};

const openForm = async (next: "edit" | "burn") => {
    mode = next;
    await tick();
    // The Burn step radios are visually hidden, so the first visible field gets the focus.
    content?.querySelector<HTMLElement>("input:not(.visually-hidden)")?.focus();
    refresh();
};

// A new selection shows the card, even if a form was open.
$effect.pre(() => {
    void view.selected;

    untrack(() => {
        mode = "card";
    });
});

let shown: string | null = null;
let hadFocus = false;

// What had focus may be replaced, or hidden with the card.
$effect.pre(() => {
    void documents.doc;
    void view.selected;
    void mode;

    // A form for a body that's gone can't come back with it.
    if (!body && mode !== "add" && mode !== "card")
        untrack(() => (mode = "card"));

    const present = body !== undefined || mode === "add";
    hadFocus = !!card?.contains(document.activeElement);
    // Hiding the focused close button would drop focus to <body>.
    if (!present && shown && hadFocus) restoreFocus(shown);
    shown = body?.id ?? null;
});

$effect(() => {
    void documents.doc;
    void view.selected;
    void mode;

    // The card re-rendered, so what had focus moves to the first thing a reader can pick next.
    if (
        hadFocus &&
        body &&
        mode === "card" &&
        !card?.contains(document.activeElement)
    ) {
        focusFirst();
    }
});

$effect.pre(() => {
    void documents.doc;
    void view.selected;
    void view.clock.sets;
    void mode;

    untrack(refresh);
});

$effect(() => {
    const off = untrack(() => units.subscribe(refresh));
    const interval = setInterval(refresh, REFRESH_MS);

    return () => {
        off();
        clearInterval(interval);
    };
});
</script>

<section
    class="{cardClasses().join(" ")} orrery__inspector"
    aria-label={adding ? "Add a body" : "Selected body"}
    hidden={!body && !adding}
    data-peek={!open && mode === "card" ? "" : undefined}
    bind:this={card}
>
    <Grip bind:open hidden={mode !== "card"} {card} />
    <Head bind:this={head} {body} {parent} {mode} cancel={cancelAdd} />
    {#if mode === "card" && parent && live.current}
        <Headline
            parentName={parent.name}
            current={live.current}
            unit={live.unit}
        />
    {/if}
    <!-- On a phone it scrolls the plate with the body, and on a wider card it adds no box. -->
    <div class="orrery__inspector-scroll">
        {#if body && parent && !adding && live.plate}
            <Plate
                {units}
                bodyName={body.name}
                parentName={parent.name}
                data={live.plate}
            />
        {/if}
        <!-- On a wider card it scrolls under the head, as a scrolling card left a blank band in Chromium's canvas. -->
        <div class="orrery__inspector-body" bind:this={content}>
            {#if card}
                {#if mode === "add"}
                    <BodyAdder
                        bind:this={adder}
                        {units}
                        name={addName}
                        footTarget={card}
                        done={cancelAdd}
                    />
                {:else if body && parent && mode === "edit"}
                    <ElementEditor
                        bind:this={editor}
                        id={body.id}
                        {units}
                        {scene}
                        footTarget={card}
                        done={() => closeForm("edit")}
                        onDraft={refresh}
                    />
                {:else if body && parent && mode === "burn"}
                    <BurnEditor
                        bind:this={burn}
                        id={body.id}
                        ghost={scene.ghost}
                        footTarget={card}
                        done={() => closeForm("burn")}
                        onDraft={refresh}
                    />
                {/if}
            {/if}
            {#if body && mode === "card"}
                {#key body.id}
                    {#if parent}
                        <Children centre={body} />
                        <Maneuvers
                            id={body.id}
                            now={live.t}
                            onEmptied={() => actions?.focusOpener("burn")}
                        />
                    {/if}
                    <Stats id={body.id} />
                {/key}
            {/if}
        </div>
    </div>
    {#if body && mode === "card"}
        {#key body.id}
            <Actions
                bind:this={actions}
                id={body.id}
                name={body.name}
                hasParent={parent !== undefined}
                {hasOrbit}
                {openForm}
            />
        {/key}
    {/if}
</section>

<style>
.orrery__inspector-scroll {
    display: contents;
}

@media (max-width: 720px) {
    /* The plate scrolls with the body, so the sheet pins only the head and the footer. */
    .orrery__inspector-scroll {
        display: flex;
        flex-direction: column;
        min-block-size: 0;
        overflow: auto;

        .orrery__inspector-body {
            flex: none;
            max-block-size: none;
            overflow: visible;
        }
    }

    /* Peeked: the grip, the head and the headline stay. */
    .orrery__inspector[data-peek] {
        :global(.orrery__orbit-meta),
        :global(.orrery__orbit-lifetime),
        :global(.orrery__plate),
        .orrery__inspector-body,
        :global(.orrery__inspector-foot) {
            display: none;
        }
    }
}
</style>
