<script lang="ts">
import type { AUnit } from "@cpluspatch/render";
import type { AddField } from "../../adding.ts";
import NumberField from "../NumberField.svelte";
import { moveMass } from "./fields.ts";

type Props = {
    /** The inputs of the fields, which the form reads. */
    inputs: Partial<Record<Exclude<AddField, "name">, HTMLInputElement>>;
    errors: Partial<Record<AddField, string | null>>;
    /** The distance unit of the semi-major axis. */
    unit: AUnit;
    /** Called when the unit switch is used. */
    onUnit: () => void;
    /** The text the semi-major axis starts with. */
    startA: string;
    /** Called when any field changes. */
    onInput: () => void;
    /** Called when the semi-major axis changes. */
    onA: () => void;
};

let {
    inputs = $bindable(),
    errors,
    unit,
    onUnit,
    startA,
    onInput,
    onA,
}: Props = $props();
</script>

<NumberField
    id="orrery-add-radius"
    name="radius"
    label="Radius"
    unit="km"
    value="500"
    step={() => 100}
    error={errors.radius}
    {onInput}
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
    {onInput}
    bind:input={inputs.mass}
/>
<NumberField
    id="orrery-add-a"
    name="a"
    label="Semi-major axis"
    {unit}
    {onUnit}
    value={startA}
    step={() => (unit === "km" ? 1000 : 0.05)}
    error={errors.a}
    onInput={onA}
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
    {onInput}
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
    {onInput}
    bind:input={inputs.i}
/>
