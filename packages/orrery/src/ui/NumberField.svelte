<script lang="ts">
import { type AUnit, otherUnit } from "@cpluspatch/render";
import { nudge } from "../burning.ts";

type Props = {
    id: string;
    /** The field's name, for the form data and the buttons' labels. */
    name: string;
    label: string;
    unit: string;
    /** Makes the unit a button that calls this, to switch between km and AU. */
    onUnit?: () => void;
    /** The text the field starts with. */
    value: string;
    /** How far − and + move the value. 1 by default. */
    step?: () => number;
    /** Moves the value one step up (`1`) or down (`-1`), in place of adding or subtracting `step`. */
    move?: (value: number, sign: 1 | -1) => number;
    /** The text of a value after − or +. */
    format?: (value: number) => string;
    /** The message under the field, `null` for none. `undefined` before it's first checked. */
    error?: string | null;
    /** A line under the error that describes the field. */
    hint?: string;
    /** Called when the value changes, by typing or stepping. */
    onInput: () => void;
    /** Called when typing ends, or after a step. */
    onChange?: () => void;
    input?: HTMLInputElement;
};

let {
    id,
    name,
    label,
    unit,
    onUnit,
    value,
    step = () => 1,
    move: stepBy,
    format = String,
    error,
    hint,
    onInput,
    onChange,
    input = $bindable(),
}: Props = $props();

const errorId = $derived(`${id}-error`);
const hintId = $derived(`${id}-hint`);
// A switch's unit is km or AU.
const shown = $derived<AUnit>(unit === "km" ? "km" : "AU");
const other = $derived(otherUnit(shown));

const nudgeBy = (sign: 1 | -1) => {
    // Stepping from a blank or half-typed value would replace it with the step.
    if (!input || Number.isNaN(input.valueAsNumber)) return;

    const { valueAsNumber } = input;

    input.value = format(
        stepBy
            ? stepBy(valueAsNumber, sign)
            : nudge(valueAsNumber, sign * step()),
    );
    onInput();
    onChange?.();
};

// The native arrows would move by 1, whatever the step is.
const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

    event.preventDefault();
    nudgeBy(event.key === "ArrowUp" ? 1 : -1);
};
</script>

<div class="orrery__form-row">
    <label for={id}>{label}</label>
    <div class="orrery__stepper">
        <button
            type="button"
            class="orrery__stepper-step"
            aria-label="Decrease {label.toLowerCase()}"
            onclick={() => nudgeBy(-1)}
        >
            −
        </button>
        <input
            {id}
            {name}
            type="number"
            inputmode="decimal"
            step="any"
            {value}
            aria-describedby={[errorId, ...(hint ? [hintId] : [])].join(" ")}
            aria-invalid={error === undefined ? undefined : error !== null}
            bind:this={input}
            oninput={onInput}
            onchange={onChange}
            onkeydown={onKeydown}
        >
        {#if onUnit}
            <button
                type="button"
                class="orrery__stepper-unit orrery__unit-switch"
                aria-label="{shown}. Show {label.toLowerCase()} in {other}"
                title="Show in {other} (U)"
                onclick={onUnit}
            >
                {unit}
            </button>
        {:else}
            <span class="orrery__stepper-unit">{unit}</span>
        {/if}
        <button
            type="button"
            class="orrery__stepper-step"
            aria-label="Increase {label.toLowerCase()}"
            onclick={() => nudgeBy(1)}
        >
            +
        </button>
    </div>
    <p class="orrery__stepper-error" id={errorId} hidden={error == null}>
        {error ?? ""}
    </p>
    {#if hint}
        <p id={hintId} class="orrery__stepper-hint">{hint}</p>
    {/if}
</div>
