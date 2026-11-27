<script lang="ts">
import { solarSystem } from "@cpluspatch/catalog";
import {
    type AUnit,
    aUnit,
    fromMetres,
    otherUnit,
    type Units,
} from "@cpluspatch/render";
import { type Body, sortByDepth } from "@cpluspatch/sim";
import { onMount } from "svelte";
import { type AddField, addErrors, newBody, slugId } from "../../adding.ts";
import { cue } from "../../audio/cues.ts";
import { getDocument, getView } from "../../state/context.ts";
import EditorForm from "../EditorForm.svelte";
import FailureAlert from "./FailureAlert.svelte";
import {
    canParent,
    defaultA,
    defaultKind,
    type ExactA,
    KINDS,
    kindOf,
    NAME_MAX,
    text,
    typedMetres,
} from "./fields.ts";
import NameRow from "./NameRow.svelte";
import OrbitFields from "./OrbitFields.svelte";
import SelectRow from "./SelectRow.svelte";

type Props = {
    /** The distance unit of the semi-major axis, which its switch changes. */
    units: Units;
    /** The text the Name field starts with. */
    name: string;
    /** The element the Cancel and Add row moves to. */
    footTarget: HTMLElement;
    /** Called when the form is cancelled. */
    done: () => void;
};

const { units, name, footTarget, done }: Props = $props();

const documents = getDocument();
const view = getView();

const root = documents.doc.scenario.bodies.find(
    (body) => body.orbit === undefined,
);
if (!root) throw new Error("The scenario has no root body.");

const parents = sortByDepth(documents.doc.scenario).filter(canParent);
const start = parents.find((body) => body.id === view.focus) ?? root;
const parentOf = (): Body =>
    parents.find((body) => body.id === parentId) ?? root;
const unitFor = (body: Body): AUnit => units.get() ?? aUnit(defaultA(body));

const parentOptions = parents.map((body): [string, string] => [
    body.id,
    body.name,
]);

const startUnit = unitFor(start);
// Only the unit switch moves the field's text, and it does so in place.
const startA = text(fromMetres(defaultA(start), startUnit));

let unit = $state(startUnit);
let kind = $state(defaultKind(start));
let parentId = $state(start.id);
let attempted = false;
// A default follows the parent until the person sets it.
let kindTouched = false;
let aTouched = false;
// A typed semi-major axis keeps its exact size across a unit switch, or the rounding would add up.
let exact: ExactA | null = null;

let nameInput = $state<HTMLInputElement>();
let inputs = $state<
    Partial<Record<Exclude<AddField, "name">, HTMLInputElement>>
>({});
const errors = $state<Partial<Record<AddField, string | null>>>({});
const failure = $state({ text: "", hidden: true });

// In the order of the form, so the first failure gets the focus.
const focusOrder = (): [AddField, HTMLInputElement | undefined][] => [
    ["name", nameInput],
    ["radius", inputs.radius],
    ["mass", inputs.mass],
    ["a", inputs.a],
    ["e", inputs.e],
    ["i", inputs.i],
];

const metresOf = (): number => {
    const input = inputs.a;
    if (!input) return Number.NaN;

    return typedMetres(input.value, input.valueAsNumber, unit, exact);
};

const numberOf = (field: keyof typeof inputs): number =>
    inputs[field]?.valueAsNumber ?? Number.NaN;

const check = (): Partial<Record<AddField, string>> => {
    const found = addErrors(
        {
            name: nameInput?.value ?? "",
            parent: parentOf(),
            radiusKm: numberOf("radius"),
            massKg: numberOf("mass"),
            aMetres: metresOf(),
            e: numberOf("e"),
            iDeg: numberOf("i"),
            unit,
        },
        documents.doc.scenario,
    );

    for (const [field] of focusOrder()) errors[field] = found[field] ?? null;

    return found;
};

const live = () => {
    if (attempted) check();
};

const showUnit = (next: AUnit) => {
    const input = inputs.a;
    if (!input) return;

    const metres = metresOf();

    unit = next;
    exact = null;
    if (!aTouched) {
        input.value = text(fromMetres(defaultA(parentOf()), unit));
    } else if (Number.isFinite(metres)) {
        const typed = text(fromMetres(metres, unit));

        input.value = typed;
        exact = { metres, text: typed };
    }

    // The limits in the message are in the old unit.
    live();
};

const onParent = (value: string) => {
    parentId = value;

    const next = parentOf();
    const input = inputs.a;

    if (!kindTouched) kind = defaultKind(next);
    if (unitFor(next) !== unit) showUnit(unitFor(next));
    else if (!aTouched && input) {
        input.value = text(fromMetres(defaultA(next), unit));
    }
    live();
};

// The units can change under the form through the switch of this field, or a shortcut.
onMount(() =>
    units.subscribe(() => {
        const next = unitFor(parentOf());
        if (next !== unit) showUnit(next);
    }),
);

/** Puts `next` in the Name field. */
export const setName = (next: string) => {
    if (nameInput) nameInput.value = next.slice(0, NAME_MAX);
    live();
};

/** Moves the focus to the Name field. */
export const focus = () => nameInput?.focus();

const submit = () => {
    attempted = true;
    failure.hidden = true;

    const found = check();
    const invalid = focusOrder().find(([field]) => found[field] !== undefined);
    if (invalid) {
        invalid[1]?.focus();

        return;
    }

    const owner = parentOf();
    const trimmed = (nameInput?.value ?? "").trim();
    const { scenario } = documents.doc;
    const body = newBody(
        {
            // Built-in ids stay reserved, since maps and spin are keyed on them.
            id: slugId(
                trimmed,
                new Set(
                    [...scenario.bodies, ...solarSystem.bodies].map(
                        ({ id }) => id,
                    ),
                ),
            ),
            name: trimmed,
            tag: kind,
            parent: owner,
            radiusKm: numberOf("radius"),
            massKg: numberOf("mass"),
            aKm: metresOf() / 1000,
            e: numberOf("e"),
            iDeg: numberOf("i"),
        },
        view.now(),
    );
    // Selecting the new body replaces the form with its card, so the root is found first.
    const orrery = nameInput?.closest<HTMLElement>(".orrery");

    const result = documents.dispatch({ type: "add-body", body });
    if (!result.ok) {
        failure.text = result.errors.join(" ");
        failure.hidden = false;

        return;
    }

    cue("add");
    view.select(body.id);
    orrery?.querySelector<HTMLElement>(".orrery__orbit-focus")?.focus();
};
</script>

<EditorForm
    id="orrery-add-form"
    {footTarget}
    applyLabel="Add"
    onApply={submit}
    onCancel={done}
>
    <NameRow
        value={name}
        error={errors.name}
        onInput={live}
        bind:input={nameInput}
    />
    <SelectRow
        id="orrery-add-kind"
        name="kind"
        label="Kind"
        value={kind}
        options={KINDS}
        onChange={(value) => {
            kind = kindOf(value);
            kindTouched = true;
            live();
        }}
    />
    <SelectRow
        id="orrery-add-parent"
        name="parent"
        label="Parent"
        value={parentId}
        options={parentOptions}
        onChange={onParent}
    />
    <OrbitFields
        bind:inputs
        {errors}
        {unit}
        onUnit={() => units.set(otherUnit(unit))}
        {startA}
        onInput={live}
        onA={() => {
            aTouched = true;
            live();
        }}
    />
    <FailureAlert text={failure.text} hidden={failure.hidden} />
</EditorForm>
