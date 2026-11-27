<script lang="ts">
import type { ComponentProps } from "svelte";
import type { HTMLFieldsetAttributes } from "svelte/elements";
import {
    type SegmentedOption,
    type SegmentedSize,
    type SegmentedVariant,
    segmentedClasses,
} from "../../components/segmented-control.ts";
import Icon from "../icon.svelte";

/**
 * A row of mutually exclusive options, as plain radios in a fieldset, so it
 * submits with a form and can drive CSS through :has() without JS. Give
 * each control its own `name`.
 */
interface Props extends Omit<HTMLFieldsetAttributes, "name"> {
    name: string;
    /** Accessible name for the group. */
    label: string;
    options: SegmentedOption[];
    /** The initially checked option, if any. */
    value?: string;
    size?: SegmentedSize;
    /** `subtle` marks the checked option with a quiet fill, not the accent. */
    variant?: SegmentedVariant;
}

const {
    name,
    label,
    options,
    value,
    size = "default",
    variant = "solid",
    class: className,
    ...rest
}: Props = $props();
</script>

<!-- biome-ignore-start lint/a11y/noLabelWithoutControl: the radio is inside the label -->
<fieldset
    class={segmentedClasses({ size, variant, class: className as string })}
    {...rest}
>
    <legend class="visually-hidden">{label}</legend>
    {#each options as option (option.value)}
        <label
            class="segmented__option"
            title={option.icon ? option.label : undefined}
            ><input
                class="visually-hidden"
                type="radio"
                {name}
                value={option.value}
                checked={option.value === value}
            >
            {#if option.icon}
                <Icon
                    name={option.icon as ComponentProps<typeof Icon>["name"]}
                    aria-hidden="true"
                /><span class="visually-hidden">{option.label}</span>
            {:else}
                <span class="segmented__text">{option.label}</span>
            {/if}</label
        >
    {/each}
</fieldset>
<!-- biome-ignore-end lint/a11y/noLabelWithoutControl: see above -->
