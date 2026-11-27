<script lang="ts">
import type { Elements } from "@cpluspatch/orbit";
import {
    aUnit,
    type EditScene,
    type Field,
    otherUnit,
    type Units,
} from "@cpluspatch/render";
import { isOrbiting } from "@cpluspatch/sim";
import { onMount } from "svelte";
import { cue } from "../audio/cues.ts";
import {
    aMin,
    draftElements,
    fieldError,
    fieldValue,
    passesThroughParent,
} from "../editing.ts";
import { getDocument, getView } from "../state/context.ts";
import EditorForm from "./EditorForm.svelte";
import {
    changedFields,
    dragText,
    type Exact,
    type Spec,
    siOf,
    specs,
    switchedA,
    type Typed,
    toDisplay,
} from "./element-fields.ts";
import NumberField from "./NumberField.svelte";
import Warning from "./Warning.svelte";

type Props = {
    id: string;
    /** The distance unit of the semi-major axis, which its switch changes. */
    units: Units;
    /** What the form draws in the scene: the ghost orbit and the grips. */
    scene: EditScene;
    /** The element the Cancel and Apply row moves to. */
    footTarget: HTMLElement;
    /** Called when the form is done, whether it changed the orbit or was cancelled. */
    done: () => void;
    /** Called when the draft may have changed, by typing, stepping or dragging a grip. */
    onDraft: () => void;
};

const { id, units, scene, footTarget, done, onDraft }: Props = $props();

const documents = getDocument();
const view = getView();

// The caller checks that the body has a parent before it mounts the form.
const lookup = () => {
    const bodies = documents.doc.scenario.bodies;
    const found = bodies.find((candidate) => candidate.id === id);
    if (!found || !isOrbiting(found))
        throw new Error(`"${id}" has no orbit to edit.`);

    const above = bodies.find(
        (candidate) => candidate.id === found.orbit.parent,
    );
    if (!above) throw new Error(`"${found.orbit.parent}" doesn't exist.`);

    return { body: found, parent: above };
};
const { body, parent } = lookup();

const original = documents.system.elementsAt(body.id, view.now());
const min = aMin(parent.mass.radius);
const opened = view.now();
const unitNow = () => units.get() ?? aUnit(original.a);
const initialUnit = unitNow();
const initialSpecs = specs(initialUnit, original.a);

/** The parent's and the body's gravitational parameters added, in m³/s². */
export const mu = parent.mass.mu + body.mass.mu;

// Only the unit switch changes it, and then the field converts in place.
let unit = $state(initialUnit);
const scale = (field: Field): Spec => {
    const found = specs(unit, original.a).find((spec) => spec.field === field);
    if (!found) throw new Error(`No field "${field}".`);

    return found;
};

const inputs = $state<Partial<Record<Field, HTMLInputElement>>>({});
const errors = $state<Partial<Record<Field, string | null>>>({});
const warning = $state({ text: "", hidden: true });

const startText = (field: Field, decimals: number): string =>
    toDisplay(field, fieldValue(original, mu, opened, field), unit).toFixed(
        decimals,
    );

const starts = new Map<Field, string>();
for (const spec of initialSpecs)
    starts.set(spec.field, startText(spec.field, spec.decimals));
// A unit switch moves `starts`, and the fields only begin from these.
const initialText = new Map(starts);

// A typed semi-major axis keeps its exact size across a unit switch, or the rounding would add up.
let exact: Exact | null = null;

const typedOf = (input: HTMLInputElement): Typed => ({
    text: input.value,
    number: input.valueAsNumber,
});

// Only the fields that changed, so an untouched mean anomaly keeps moving with the clock.
const changes = () =>
    changedFields(
        initialSpecs.map((spec) => spec.field),
        (field) => {
            const input = inputs[field];

            return input && typedOf(input);
        },
        { starts, exact, a: original.a, unit },
    );

// `show` also puts the messages under the fields. Typing only clears the ones it fixed.
const check = (show: boolean): boolean => {
    const found = new Map(
        changes().map(([field, si]) => [
            field,
            fieldError(field, si, { aMin: min, unit }),
        ]),
    );
    let ok = true;

    for (const { field } of initialSpecs) {
        if (!inputs[field]) continue;

        const error = found.get(field) ?? null;
        if (error !== null) ok = false;
        if (show || error === null) errors[field] = error;
    }

    return ok;
};

const draft = (): Elements | null =>
    check(false)
        ? draftElements(original, mu, view.now(), Object.fromEntries(changes()))
        : null;

// Kept for the grips, which read it every frame.
let current = draft();
// The plate keeps drawing this while the fields are invalid.
let lastValid = current ?? original;

/** The last valid draft, or the original orbit while nothing was changed. */
export const elements = (): Elements => lastValid;

const preview = () => {
    const next = draft();
    current = next;
    if (next) lastValid = next;

    scene.ghost(id, changes().length > 0 ? next : null);
    warning.text = `This orbit passes through ${parent.name}.`;
    warning.hidden =
        next === null || !passesThroughParent(next, parent.mass.radius);
    onDraft();
};

// A drag writes the fields, so they stay the source of truth.
const setFromDrag = (change: Partial<Record<Field, number>>) => {
    for (const { field } of initialSpecs) {
        const input = inputs[field];
        const si = change[field];
        if (!input || si === undefined) continue;

        input.value = dragText(
            field,
            si,
            unit,
            scale(field).decimals,
            fieldValue(original, mu, view.now(), "m"),
            starts.get("m") ?? "",
        );
        if (field === "a") exact = { metres: si, text: input.value };
    }

    preview();
    check(true);
};

const clearScene = () => {
    scene.ghost(id, null);
    scene.grips(null);
};

onMount(() => {
    scene.grips({
        id,
        original,
        elements: () => current,
        minPeriapsis: min,
        meanAnomaly: (el) => fieldValue(el, mu, view.now(), "m"),
        set: setFromDrag,
    });

    // The units can change under the form only through the switch of this field.
    const offUnits = units.subscribe(() => {
        const next = unitNow();
        const input = inputs.a;
        if (next === unit || !input) return;

        const untouched = input.value === starts.get("a");
        const metres = siOf("a", typedOf(input), unit, exact);

        unit = next;

        const { decimals } = scale("a");
        const start = startText("a", decimals);
        starts.set("a", start);
        exact = null;

        const switched = switchedA(untouched, metres, unit, decimals, start);
        if (switched) {
            input.value = switched.text;
            exact = switched.exact;
        }

        // The limits in the message are in the old unit.
        if (typeof errors.a === "string") check(true);
    });

    return () => {
        offUnits();
        clearScene();
    };
});

const submit = () => {
    if (!check(true)) {
        const first = initialSpecs.find(
            ({ field }) => typeof errors[field] === "string",
        );
        if (first) inputs[first.field]?.focus();

        return;
    }

    const next = draft();
    if (next && changes().length > 0) {
        cue("edit");
        const result = documents.dispatch({
            type: "set-orbit",
            bodyId: id,
            t: view.now(),
            elements: next,
        });
        if (!result.ok) throw new Error(result.errors.join(" "));
    }

    clearScene();
    done();
};
</script>

<EditorForm
    id="orrery-edit-form"
    pairs
    {footTarget}
    onApply={submit}
    onCancel={() => {
        clearScene();
        done();
    }}
>
    <p class="orrery__form-hint">
        Type values, or drag Pe, Ap, Node and Inc in the view.
    </p>
    {#each initialSpecs as { field, label } (field)}
        <NumberField
            id="orrery-edit-{field}"
            name={field}
            {label}
            unit={scale(field).unit}
            onUnit={field === "a"
                ? () => units.set(otherUnit(unit))
                : undefined}
            value={initialText.get(field) ?? ""}
            step={() => scale(field).step}
            format={(x) => x.toFixed(scale(field).decimals)}
            error={errors[field]}
            onInput={preview}
            onChange={() => check(true)}
            bind:input={inputs[field]}
        />
    {/each}
    <Warning text={warning.text} hidden={warning.hidden} />
</EditorForm>
