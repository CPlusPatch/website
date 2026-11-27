<script lang="ts">
import {
    type Burn,
    type Elements,
    nextApsisTime,
    period,
} from "@cpluspatch/orbit";
import { formatDuration } from "@cpluspatch/render";
import { isOrbiting } from "@cpluspatch/sim";
import { onMount } from "svelte";
import { cue } from "../audio/cues.ts";
import { failureMessage, isZero, sameElements } from "../burning.ts";
import { getDocument, getView } from "../state/context.ts";
import BurnApsides from "./BurnApsides.svelte";
import BurnAxes from "./BurnAxes.svelte";
import EditorForm from "./EditorForm.svelte";
import Warning from "./Warning.svelte";

type Axis = keyof Burn;

type Props = {
    id: string;
    /** Draws the orbit after the burn, or none with `null`. */
    ghost: (id: string, elements: Elements | null) => void;
    /** The element the Cancel and Apply row moves to. */
    footTarget: HTMLElement;
    /** Called when the form is done, whether it burned or was cancelled. */
    done: () => void;
    /** Called when typing or stepping changes the burn. */
    onDraft: () => void;
};

const { id, ghost, footTarget, done, onDraft }: Props = $props();

const documents = getDocument();
const view = getView();

// The scenario is replaced on every edit, so read it again each time.
const context = () => {
    const bodies = documents.doc.scenario.bodies;
    const body = bodies.find((candidate) => candidate.id === id);
    if (!body || !isOrbiting(body)) return null;

    const parent = bodies.find(
        (candidate) => candidate.id === body.orbit.parent,
    );
    if (!parent) return null;

    return {
        body,
        el: documents.system.elementsAt(id, view.now()),
        mu: parent.mass.mu + body.mass.mu,
        parent,
    };
};

// The caller checks that the body has a parent before it mounts the form.
const start = context();
if (!start) throw new Error("The body has no orbit to burn on.");

/** The parent's and the body's `mu` added, for the true anomaly of the elements. */
export const mu = start.mu;

let ghosted: Elements | null = null;
let wasNonzero = false;
// Only a pause this editor made is undone when the form closes.
let pausedHere = false;

let inputs = $state<Partial<Record<Axis, HTMLInputElement>>>({});
// Set by `refresh`, so `elements` doesn't predict the burn again.
let predicted = $state.raw<Elements | null>(null);
let periodText = $state("");
let applyDisabled = $state(true);
const warning = $state({ text: "", hidden: true });

/** The orbit after the burn, or `null` while there's no valid burn. */
export const elements = (): Elements | null => predicted;

$effect(() => {
    if (!view.clock.paused) pausedHere = false;
});

const read = (): Burn => ({
    prograde: inputs.prograde?.valueAsNumber || 0,
    normal: inputs.normal?.valueAsNumber || 0,
    radial: inputs.radial?.valueAsNumber || 0,
});

const showGhost = (next: Elements | null) => {
    if (next === null) {
        if (ghosted) ghost(id, null);
        ghosted = null;
    } else if (!ghosted || !sameElements(ghosted, next)) {
        ghost(id, next);
        ghosted = next;
    }
};

/** Predicts the burn again. */
export const refresh = () => {
    const c = context();
    if (!c) return;

    const dv = read();
    const result = isZero(dv)
        ? null
        : documents.previewBurn(id, view.now(), dv);

    predicted = result?.ok ? result.elements : null;
    if (predicted) periodText = formatDuration(period(predicted, c.mu));

    warning.hidden = !result || result.ok;
    if (result && !result.ok) {
        warning.text = failureMessage(
            result.reason,
            c.parent.name,
            c.body.name,
        );
    }

    applyDisabled = !result?.ok;
    showGhost(predicted);
};

// Not part of `refresh`, as the card's `onDraft` runs `refresh` again and would loop.
const redraw = () => {
    refresh();
    onDraft();
};

// The first nudge from zero stops the clock, so the burn is made where it's shown.
const changed = () => {
    // A half-typed number like "-" reads as 0 but isn't a return to zero.
    if (Object.values(inputs).some((input) => input?.validity.badInput)) {
        redraw();
        return;
    }

    const nonzero = !isZero(read());
    if (nonzero && !wasNonzero && !view.clock.paused) {
        view.setClock({ paused: true });
        pausedHere = true;
    }
    if (!nonzero) pausedHere = false;
    wasNonzero = nonzero;
    redraw();
};

const resume = () => {
    if (pausedHere && view.clock.paused) view.setClock({ paused: false });
    pausedHere = false;
};

const goTo = (apsis: "periapsis" | "apoapsis") => {
    const c = context();
    if (!c) return;

    view.setClock({
        t: nextApsisTime(c.el, c.mu, view.now(), apsis),
        paused: true,
    });
};

const apply = () => {
    const dv = read();
    if (!documents.previewBurn(id, view.now(), dv).ok) return;

    const result = documents.dispatch({
        type: "schedule-burn",
        bodyId: id,
        t: view.now(),
        dv,
    });
    if (!result.ok) throw new Error(result.errors.join(" "));

    cue("edit");
    resume();
    done();
};

const cancel = () => {
    for (const input of Object.values(inputs)) if (input) input.value = "0";
    wasNonzero = false;
    refresh();
    resume();
    done();
};

onMount(() => () => {
    showGhost(null);
    resume();
});
</script>

<EditorForm
    id="orrery-burn-form"
    {footTarget}
    {applyDisabled}
    onApply={apply}
    onCancel={cancel}
>
    <BurnAxes bind:inputs onChange={changed} />
    <BurnApsides {goTo} />
    <div hidden={!predicted}>
        <h3 id="orrery-burn-after" class="orrery__burn-heading">
            After the burn
        </h3>
        <dl class="orrery__readouts" aria-labelledby="orrery-burn-after">
            <dt>Period</dt>
            <dd class="orrery__readout">{periodText}</dd>
        </dl>
    </div>
    <Warning text={warning.text} hidden={warning.hidden} />
</EditorForm>

<style>
.orrery__burn-heading {
    margin: 0;
    color: var(--color-text-muted);
    font: var(--type-label);
}
</style>
