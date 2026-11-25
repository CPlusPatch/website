<script module lang="ts">
import { AU } from "@cpluspatch/orbit";
import { styleOf, TAG_STYLES } from "@cpluspatch/render";
import type { Body } from "@cpluspatch/sim";

/** The longest name the Name field takes. */
const NAME_MAX = 40;

/** The select's options: the tags the table offers, as a value and a label. */
const KINDS: [string, string][] = Object.entries(TAG_STYLES)
    .filter(([, style]) => style.adder)
    .map(([tag, style]) => [tag, style.label]);

const kindOf = (value: string): string => {
    const found = KINDS.find(([kind]) => kind === value);
    if (!found)
        throw new Error(`The Kind select holds an unknown kind, ${value}.`);

    return found[0];
};

// Asteroids can have moons, like Didymos.
const canParent = (body: Body): boolean => styleOf(body).canParent;

/** A new body's kind around `parent`: a planet around the root, else a moon. */
const defaultKind = (parent: Body): string =>
    parent.orbit === undefined ? "planet" : "moon";

/** A new body's semi-major axis around `parent`, in metres. */
const defaultA = (parent: Body): number =>
    parent.orbit === undefined ? AU : parent.mass.radius * 10;

// Rounded to drop float noise, like 1.0000000000000001e+21.
const moveMass = (value: number, sign: 1 | -1): number =>
    Number((sign === 1 ? value * 10 : value / 10).toPrecision(12));

const text = (x: number): string => String(Number(x.toPrecision(10)));
</script>

<script lang="ts">
import { solarSystem } from "@cpluspatch/catalog";
import {
    type AUnit,
    aUnit,
    fromMetres,
    otherUnit,
    toMetres,
    type Units,
} from "@cpluspatch/render";
import { sortByDepth } from "@cpluspatch/sim";
import { alertClasses, alertPrefix } from "@cpluspatch/ui/components/alert.ts";
import { onMount } from "svelte";
import { type AddField, addErrors, newBody, slugId } from "../adding.ts";
import { cue } from "../audio/cues.ts";
import { getDocument, getView } from "../state/context.ts";
import EditorForm from "./EditorForm.svelte";
import NumberField from "./NumberField.svelte";

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
let exact: { metres: number; text: string } | null = null;

let nameInput = $state<HTMLInputElement>();
const inputs = $state<
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

    return exact?.text === input.value
        ? exact.metres
        : toMetres(input.valueAsNumber, unit);
};

const check = (): Partial<Record<AddField, string>> => {
    const found = addErrors(
        {
            name: nameInput?.value ?? "",
            parent: parentOf(),
            radiusKm: inputs.radius?.valueAsNumber ?? Number.NaN,
            massKg: inputs.mass?.valueAsNumber ?? Number.NaN,
            aMetres: metresOf(),
            e: inputs.e?.valueAsNumber ?? Number.NaN,
            iDeg: inputs.i?.valueAsNumber ?? Number.NaN,
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
            radiusKm: inputs.radius?.valueAsNumber ?? Number.NaN,
            massKg: inputs.mass?.valueAsNumber ?? Number.NaN,
            aKm: metresOf() / 1000,
            e: inputs.e?.valueAsNumber ?? Number.NaN,
            iDeg: inputs.i?.valueAsNumber ?? Number.NaN,
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
    <div class="orrery__form-row">
        <label for="orrery-add-name">Name</label>
        <div class="orrery__stepper orrery__stepper--text">
            <input
                type="text"
                name="name"
                maxlength={NAME_MAX}
                autocomplete="off"
                spellcheck="false"
                id="orrery-add-name"
                aria-describedby="orrery-add-name-error"
                aria-invalid={errors.name === undefined
                    ? undefined
                    : errors.name !== null}
                value={name.slice(0, NAME_MAX)}
                bind:this={nameInput}
                oninput={live}
            >
        </div>
        <p
            class="orrery__stepper-error"
            id="orrery-add-name-error"
            hidden={errors.name == null}
        >
            {errors.name ?? ""}
        </p>
    </div>
    <div class="orrery__form-row">
        <label for="orrery-add-kind">Kind</label>
        <div class="orrery__stepper orrery__stepper--select">
            <select
                name="kind"
                id="orrery-add-kind"
                aria-describedby="orrery-add-kind-error"
                value={kind}
                onchange={(event) => {
                    kind = kindOf(event.currentTarget.value);
                    kindTouched = true;
                    live();
                }}
            >
                {#each KINDS as [value, label] (value)}
                    <option {value}>{label}</option>
                {/each}
            </select>
        </div>
        <p class="orrery__stepper-error" id="orrery-add-kind-error" hidden></p>
    </div>
    <div class="orrery__form-row">
        <label for="orrery-add-parent">Parent</label>
        <div class="orrery__stepper orrery__stepper--select">
            <select
                name="parent"
                id="orrery-add-parent"
                aria-describedby="orrery-add-parent-error"
                value={parentId}
                onchange={(event) => onParent(event.currentTarget.value)}
            >
                {#each parents as body (body.id)}
                    <option value={body.id}>{body.name}</option>
                {/each}
            </select>
        </div>
        <p
            class="orrery__stepper-error"
            id="orrery-add-parent-error"
            hidden
        ></p>
    </div>
    <NumberField
        id="orrery-add-radius"
        name="radius"
        label="Radius"
        unit="km"
        value="500"
        step={() => 100}
        error={errors.radius}
        onInput={live}
        bind:input={inputs.radius}
    />
    <NumberField
        id="orrery-add-mass"
        name="mass"
        label="Mass"
        unit="kg"
        value="1e20"
        move={moveMass}
        error={errors.mass}
        onInput={live}
        bind:input={inputs.mass}
    />
    <NumberField
        id="orrery-add-a"
        name="a"
        label="Semi-major axis"
        {unit}
        onUnit={() => units.set(otherUnit(unit))}
        value={startA}
        step={() => (unit === "km" ? 1000 : 0.05)}
        error={errors.a}
        onInput={() => {
            aTouched = true;
            live();
        }}
        bind:input={inputs.a}
    />
    <NumberField
        id="orrery-add-e"
        name="e"
        label="Eccentricity"
        unit=""
        value="0"
        step={() => 0.01}
        error={errors.e}
        onInput={live}
        bind:input={inputs.e}
    />
    <NumberField
        id="orrery-add-i"
        name="i"
        label="Inclination"
        unit="°"
        value="0"
        step={() => 1}
        error={errors.i}
        onInput={live}
        bind:input={inputs.i}
    />
    <div
        class="{alertClasses({ variant: "destructive" }).join(
            " ",
        )} orrery__warning"
        role="alert"
        hidden={failure.hidden}
    >
        <div class="content">
            <p>
                <span class="visually-hidden"
                    >{alertPrefix("destructive") ?? ""}</span
                >
                <span>{failure.text}</span>
            </p>
        </div>
    </div>
</EditorForm>
