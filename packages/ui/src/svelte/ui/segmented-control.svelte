<script lang="ts">
import type { ComponentProps } from "svelte";
import type { HTMLFieldsetAttributes } from "svelte/elements";
import { initSegmentedControl } from "../../behaviours/segmented-control.ts";
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
    /** `subtle` marks the checked option with a thin neutral bar, not the accent. */
    variant?: SegmentedVariant;
    /** Stretch to the container, the options sharing the width. */
    fill?: boolean;
}

const {
    name,
    label,
    options,
    value,
    size = "default",
    variant = "solid",
    fill = false,
    class: className,
    ...rest
}: Props = $props();

let root: HTMLFieldSetElement | undefined = $state();

$effect(() => (root ? initSegmentedControl(root) : undefined));
</script>

<!-- biome-ignore-start lint/a11y/noLabelWithoutControl: the radio is inside the label -->
<!-- biome-ignore format: Svelte renders whitespace between siblings as text, which Astro doesn't -->
<fieldset bind:this={root} class={segmentedClasses({ size, variant, fill, class: className as string })} {...rest}
    ><legend class="visually-hidden">{label}</legend
    ><div class="segmented__options">
        {#each options as option (option.value)}
            <label class="segmented__option" title={option.icon && !option.showLabel ? option.label : undefined}
                ><input class="visually-hidden" type="radio" {name} value={option.value} checked={option.value === value}>
                {#if option.icon}<Icon name={option.icon as ComponentProps<typeof Icon>["name"]} aria-hidden="true" />{/if}
                {#if option.icon && !option.showLabel}<span class="visually-hidden">{option.label}</span>{:else}<span class="segmented__text">{option.label}</span>{/if}</label
            >
        {/each}
    </div></fieldset
>
<!-- biome-ignore-end lint/a11y/noLabelWithoutControl: see above -->
