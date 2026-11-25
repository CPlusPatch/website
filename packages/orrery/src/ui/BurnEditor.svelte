<script lang="ts">
import {
    type Burn,
    type Elements,
    nextApsisTime,
    period,
} from "@cpluspatch/orbit";
import { formatDuration } from "@cpluspatch/render";
import { elementsAt } from "@cpluspatch/sim";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { segmentedClasses } from "@cpluspatch/ui/components/segmented-control.ts";
import { onMount } from "svelte";
import { cue } from "../audio/cues.ts";
import { failureMessage, isZero, STEPS, sameElements } from "../burning.ts";
import { getDocument, getView } from "../state/context.ts";
import EditorForm from "./EditorForm.svelte";
import NumberField from "./NumberField.svelte";
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

const AXES: [axis: Axis, name: string, hint?: string][] = [
    ["prograde", "Prograde"],
    ["normal", "Normal"],
    [
        "radial",
        "Radial",
        "Away from the parent, at right angles to the velocity. It points straight out only on a circular orbit.",
    ],
];

const DEFAULT_STEP = 10;

const { id, ghost, footTarget, done, onDraft }: Props = $props();

const documents = getDocument();
const view = getView();

// The scenario is replaced on every edit, so read it again each time.
const context = () => {
    const bodies = documents.doc.scenario.bodies;
    const body = bodies.find((candidate) => candidate.id === id);
    if (!body || body.parent === null) return null;

    const parent = bodies.find((candidate) => candidate.id === body.parent);
    if (!parent) return null;

    return {
        body,
        el: elementsAt(body, view.now()),
        mu: parent.mu + body.mu,
        parent,
    };
};

// The caller checks that the body has a parent before it mounts the form.
const start = context();
if (!start) throw new Error("The body has no orbit to burn on.");

/** The parent's and the body's `mu` added, for the true anomaly of the elements. */
export const mu = start.mu;

let step = DEFAULT_STEP;
let ghosted: Elements | null = null;
let wasNonzero = false;
// Only a pause this editor made is undone when the form closes.
let pausedHere = false;

const inputs = $state<Partial<Record<Axis, HTMLInputElement>>>({});
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
    <fieldset class="orrery__burn-dv">
        <legend class="visually-hidden">Δv</legend>
        <div class="orrery__burn-step">
            <span aria-hidden="true">Step</span>
            <fieldset class={segmentedClasses({ variant: "subtle" }).join(" ")}>
                <legend class="visually-hidden">Step</legend>
                {#each STEPS as value (value)}
                    <label class="segmented__option"
                        ><input
                            class="visually-hidden"
                            type="radio"
                            name="orrery-burn-step"
                            value={String(value)}
                            checked={value === DEFAULT_STEP}
                            onchange={() => {
                                step = value;
                            }}
                        ><span class="segmented__text"
                            >{String(value)}<span class="visually-hidden"
                                >{" m/s"}</span
                            ></span
                        ></label
                    >
                {/each}
            </fieldset>
            <span aria-hidden="true">m/s</span>
        </div>
        <!-- Any Δv is allowed; the step only sets how far − and + move it. -->
        {#each AXES as [axis, name, hint] (axis)}
            <NumberField
                id="orrery-burn-{axis}"
                name={axis}
                label={name}
                unit="m/s"
                value="0"
                step={() => step}
                {hint}
                onInput={changed}
                onChange={() => {
                    // An empty or half-typed field reads as 0, so it says so on blur.
                    const input = inputs[axis];
                    if (input?.value !== "") return;

                    input.value = "0";
                    changed();
                }}
                bind:input={inputs[axis]}
            />
        {/each}
    </fieldset>
    <div class="orrery__burn-actions">
        <button
            type="button"
            class={buttonClasses({ variant: "outline", tone: "neutral" }).join(
                " ",
            )}
            onclick={() => goTo("periapsis")}
        >
            Go to periapsis
        </button><button
            type="button"
            class={buttonClasses({ variant: "outline", tone: "neutral" }).join(
                " ",
            )}
            onclick={() => goTo("apoapsis")}
        >
            Go to apoapsis
        </button>
    </div>
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
/* Equal columns, so buttons that wrap still line up. */
.orrery__burn-actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    margin-block-start: var(--space-md);
    gap: var(--space-xs);
}

/* A wrapped label spills out of the fixed-height button. */
.orrery__burn-actions :global(.button) {
    white-space: nowrap;
}

.orrery__burn-dv {
    display: grid;
    gap: 0.625rem;
    margin: 0;
    padding: 0;
    border: 0;
    min-inline-size: 0;
}

.orrery__burn-step {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-block-end: var(--space-md);
    color: var(--color-text-muted);
    font: var(--type-ui);
}

.orrery__burn-step :global(.segmented__text) {
    font-family: var(--orrery-font-data);
}

/* The chosen step needs more than a text colour to be seen. */
.orrery__burn-step :global(.segmented__option:has(:checked)) {
    background-color: var(--orrery-panel-raised);
    box-shadow: inset 0 0 0 1px var(--orrery-text);
}

@media (forced-colors: active) {
    .orrery__burn-step :global(.segmented__option:has(:checked)) {
        box-shadow: none;
        background-color: Highlight;
        color: HighlightText;
    }
}

.orrery__burn-heading {
    margin: 0;
    color: var(--color-text-muted);
    font: var(--type-label);
}
</style>
