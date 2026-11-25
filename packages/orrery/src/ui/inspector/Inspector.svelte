<script module lang="ts">
/** What the card shows: the readouts, or a form that replaces them. */
type Mode = "card" | "edit" | "burn" | "add";

/** How often the readouts refresh while the clock runs, in ms. */
const REFRESH_MS = 250;
</script>

<script lang="ts">
import { apoapsis, periapsis, trueAnomalyAt } from "@cpluspatch/orbit";
import {
    type AUnit,
    colorOf,
    type EditScene,
    type Units,
} from "@cpluspatch/render";
import { elementsAt, type Readouts, readouts, statesAt } from "@cpluspatch/sim";
import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { cardClasses } from "@cpluspatch/ui/components/card.ts";
import { tick, untrack } from "svelte";
import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";
import { getDocument, getView } from "../../state/context.ts";
import BodyAdder from "../BodyAdder.svelte";
import BurnEditor from "../BurnEditor.svelte";
import { bodyMarker } from "../body-marker.ts";
import ElementEditor from "../ElementEditor.svelte";
import { KIND_LABELS } from "../labels.ts";
import { sheetAfterDrag } from "../sheet.ts";
import Actions from "./Actions.svelte";
import Children from "./Children.svelte";
import Headline from "./Headline.svelte";
import Plate from "./Plate.svelte";
import type { PlateData } from "./plate.ts";
import Stats from "./Stats.svelte";

type Props = {
    units: Units;
    /** Takes keyboard focus when the inspector hides while it holds it. */
    restoreFocus: (id: string) => void;
    /** What the editors draw in the scene. */
    scene: EditScene;
};

/** What the headline and the plate show, as of the last refresh. */
type Live = {
    current: Readouts | null;
    unit: AUnit | null;
    plate: PlateData | null;
};

const { units, restoreFocus, scene }: Props = $props();

const documents = getDocument();
const view = getView();

let card = $state<HTMLElement>();
let content: HTMLElement | undefined;
let grip: HTMLButtonElement | undefined;
let close: HTMLButtonElement | undefined;
let actions = $state.raw<ReturnType<typeof Actions>>();
let editor = $state.raw<ReturnType<typeof ElementEditor>>();
let burn = $state.raw<ReturnType<typeof BurnEditor>>();
let adder = $state.raw<ReturnType<typeof BodyAdder>>();

let mode = $state<Mode>("card");
let addName = $state("");
// On a phone the card is a sheet. It starts peeked and keeps its state across bodies.
let open = $state(false);
let pressedAt: number | null = null;
let live = $state.raw<Live>({ current: null, unit: null, plate: null });

const body = $derived(
    documents.doc.scenario.bodies.find(
        (candidate) => candidate.id === view.selected,
    ),
);
const parent = $derived(
    documents.doc.scenario.bodies.find(
        (candidate) => candidate.id === body?.parent,
    ),
);
const hasOrbit = $derived(parent !== undefined && body?.elements !== undefined);
const adding = $derived(mode === "add");
const title = $derived(
    adding
        ? "Add a body"
        : mode === "card"
          ? (body?.name ?? "")
          : `${mode === "edit" ? "Edit" : "Burn"} ${body?.name ?? ""}`,
);

const refresh = () => {
    if (mode === "burn") burn?.refresh();
    // A form that draws its draft in the plate.
    const form = mode === "edit" ? editor : mode === "burn" ? burn : undefined;

    const id = view.selected;
    if (!id) return;

    const t = view.now();
    const scenario = documents.doc.scenario;
    const current = readouts(scenario, id, statesAt(documents.system, t), t);
    const selected = scenario.bodies.find((b) => b.id === id);
    const around = scenario.bodies.find((b) => b.id === selected?.parent);
    const unit = units.get();
    let plate: PlateData | null = null;

    if (selected?.elements && around) {
        const grandparent = scenario.bodies.find((b) => b.id === around.parent);
        const drawn = {
            parentRadius: around.radius,
            bodyColor: colorOf(selected, around),
            parentColor: colorOf(around, grandparent),
            unit,
        };

        // A form draws its draft, without the times, as they'd be of the saved orbit.
        const draft = form?.elements();
        if (form && draft) {
            plate = {
                a: draft.a,
                e: draft.e,
                raan: draft.raan,
                argp: draft.argp,
                trueAnomaly: trueAnomalyAt(draft, form.mu, t),
                periapsisAltitude: periapsis(draft) - around.radius,
                apoapsisAltitude: apoapsis(draft) - around.radius,
                ...drawn,
            };
        } else if (current) {
            // Precession turns the node and the periapsis.
            const now = elementsAt(
                { ...selected, elements: selected.elements },
                t,
            );
            plate = {
                a: now.a,
                e: now.e,
                raan: now.raan,
                argp: now.argp,
                trueAnomaly: current.trueAnomaly,
                periapsisAltitude: current.periapsisAltitude,
                apoapsisAltitude: current.apoapsisAltitude,
                timeToPeriapsis: current.timeToPeriapsis,
                timeToApoapsis: current.timeToApoapsis,
                ...drawn,
            };
        }
    }

    live = { current, unit, plate };
};

const focusFirst = () => {
    const next =
        card?.querySelector<HTMLElement>(
            "li:not([hidden]) > .orrery__orbit-chip",
        ) ?? card?.querySelector<HTMLElement>(".orrery__orbit-link");
    (next ?? close)?.focus();
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

const openForm = async (next: "edit" | "burn") => {
    mode = next;
    await tick();
    // The Burn step radios are visually hidden, so the first visible field gets the focus.
    content?.querySelector<HTMLElement>("input:not(.visually-hidden)")?.focus();
    refresh();
};

const setSheet = (next: boolean) => {
    open = next;

    // The actions are about to be hidden, which would drop the focus.
    const held = document.activeElement?.closest(
        ".orrery__orbit-meta, .orrery__inspector-body, .orrery__inspector-foot",
    );
    if (!next && held && card?.contains(held)) grip?.focus();
};

const dragEnd = (event: PointerEvent) => {
    if (pressedAt === null) return;

    const dy = event.clientY - pressedAt;
    pressedAt = null;
    setSheet(sheetAfterDrag(dy, open));
};

// A native listener, as the shortcut that clears the selection would see a delegated one too late.
const cancelOnEscape: Attachment<HTMLElement> = (node) =>
    on(node, "keydown", (event) => {
        if (event.key !== "Escape" || mode !== "add") return;

        // The form's Esc doesn't reach the head.
        event.preventDefault();
        cancelAdd();
    });

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
    <button
        type="button"
        class="orrery__orbit-grip"
        aria-label="All readouts"
        aria-expanded={open}
        hidden={mode !== "card"}
        bind:this={grip}
        onpointerdown={(event) => {
            if (event.button !== 0 || !event.isPrimary) return;

            pressedAt = event.clientY;
            grip?.setPointerCapture(event.pointerId);
        }}
        onpointerup={dragEnd}
        onpointercancel={() => {
            pressedAt = null;
        }}
        onclick={(event) => {
            // A pointer tap is handled on pointerup, so only a keyboard click gets here.
            if (event.detail === 0) setSheet(!open);
        }}
    ></button>
    <div class="orrery__inspector-head orrery__inspector-head--ruled">
        <div class="orrery__inspector-titles">
            <h2 id="orrery-orbit-title" class="orrery__inspector-title">
                <span
                    class="orrery__orbit-marker"
                    hidden={adding}
                    style:color={body ? colorOf(body, parent) : undefined}
                    >{@html body ? bodyMarker(body) : ""}</span
                ><span>{title}</span>
            </h2>
            <!-- Under the title, so the form heads keep the kind and parent in view too. -->
            <p class="orrery__orbit-meta" hidden={mode !== "card"}>
                {#if body && !adding}
                    {`${KIND_LABELS[body.kind]} `}
                    {#if parent}
                        around
                        <!-- Keyed, so following it re-renders the link and the focus moves on. -->
                        {#key body.id}
                            <button
                                type="button"
                                class="orrery__orbit-link"
                                onclick={() => view.select(parent.id)}
                            >
                                {parent.name}
                            </button>
                        {/key}
                    {:else}
                        at the centre
                    {/if}
                {/if}
            </p>
        </div>
        <button
            type="button"
            class={buttonClasses({
                variant: "ghost",
                tone: "neutral",
                size: "icon-sm",
            }).join(" ")}
            aria-label={adding ? "Cancel" : "Clear selection"}
            bind:this={close}
            onclick={() => {
                if (mode === "add") cancelAdd();
                else view.select(null);
            }}
            {@attach cancelOnEscape}
        >
            {@html iconSvg("x")}
        </button>
    </div>
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
