<script lang="ts">
import type { HTMLSelectAttributes } from "svelte/elements";

interface Props extends HTMLSelectAttributes {
    /** Accessible name. Selects have no visible label of their own. */
    label: string;
    options: {
        value: string;
        label: string;
    }[];
    value?: string;
}

const { label, options, value, class: className, ...rest }: Props = $props();
</script>

<select class={["select", className]} aria-label={label} {...rest}>
    {#each options as option (option.value)}
        <option
            class="select__option"
            value={option.value}
            selected={option.value === value}
        >
            {option.label}
        </option>
    {/each}
</select>
