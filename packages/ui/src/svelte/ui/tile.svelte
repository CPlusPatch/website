<script lang="ts">
import type { Snippet } from "svelte";
import type { HTMLLabelAttributes } from "svelte/elements";
import { tileClasses, tileTitle } from "../../components/tile.ts";

/**
 * One choice in a <TilePicker>: a radio drawn as its preview (the children)
 * and an optional `caption` under it. The caption, when there is one, is
 * the accessible name. Without it, `label` is, as hidden text. `label` is
 * also the tooltip, unless it matches the caption. The preview is hidden
 * from assistive tech, since it's only a picture.
 */
interface Props extends HTMLLabelAttributes {
    /** Which radio group it belongs to. */
    name: string;
    value: string;
    checked?: boolean;
    disabled?: boolean;
    /** Accessible name when there's no caption, else a tooltip. */
    label: string;
    caption?: string;
    children?: Snippet;
}

const {
    name,
    value,
    checked = false,
    disabled = false,
    label,
    caption,
    class: className,
    children,
    ...rest
}: Props = $props();
</script>

<!-- biome-ignore-start lint/a11y/noLabelWithoutControl: the radio is inside the label -->
<!-- biome-ignore format: whitespace between the elements is output, and Astro emits none -->
<label
    class={tileClasses(className as string)}
    title={tileTitle(label, caption)}
    {...rest}
    ><input class="visually-hidden" type="radio" {name} {value} {checked} {disabled}
    ><span class="tile__preview" aria-hidden="true">{@render children?.()}</span>
    {#if caption}
        <span class="tile__caption">{caption}</span>
    {:else}
        <span class="visually-hidden">{label}</span>
    {/if}</label
>
<!-- biome-ignore-end lint/a11y/noLabelWithoutControl: see above -->
