<script lang="ts">
type Props = {
    /** The select's id, which the label and the error's id build on. */
    id: string;
    name: string;
    label: string;
    value: string;
    /** The options, as a value and a label. */
    options: [string, string][];
    /** Called with the value the person picked. */
    onChange: (value: string) => void;
};

const { id, name, label, value, options, onChange }: Props = $props();
</script>

<div class="orrery__form-row">
    <label for={id}>{label}</label>
    <div class="orrery__stepper orrery__stepper--select">
        <select
            {name}
            {id}
            aria-describedby="{id}-error"
            {value}
            onchange={(event) => onChange(event.currentTarget.value)}
        >
            {#each options as [optionValue, optionLabel] (optionValue)}
                <option value={optionValue}>{optionLabel}</option>
            {/each}
        </select>
    </div>
    <p class="orrery__stepper-error" id="{id}-error" hidden></p>
</div>
