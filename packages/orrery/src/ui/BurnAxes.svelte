<script lang="ts">
import type { Burn } from "@cpluspatch/orbit";
import { segmentedClasses } from "@cpluspatch/ui/components/segmented-control.ts";
import { STEPS } from "../burning.ts";
import NumberField from "./NumberField.svelte";

type Axis = keyof Burn;

type Props = {
    /** The field of each axis. */
    inputs: Partial<Record<Axis, HTMLInputElement>>;
    /** Called when typing or stepping changes the burn. */
    onChange: () => void;
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

let { inputs = $bindable(), onChange }: Props = $props();

let step = DEFAULT_STEP;
</script>

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
            onInput={onChange}
            onChange={() => {
                // An empty or half-typed field reads as 0, so it says so on blur.
                const input = inputs[axis];
                if (input?.value !== "") return;

                input.value = "0";
                onChange();
            }}
            bind:input={inputs[axis]}
        />
    {/each}
</fieldset>

<style>
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
</style>
