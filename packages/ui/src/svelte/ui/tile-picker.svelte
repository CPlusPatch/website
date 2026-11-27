<script lang="ts">
import type { Snippet } from "svelte";
import type { HTMLFieldsetAttributes } from "svelte/elements";
import {
    type TilePickerSize,
    type TilePickerVariant,
    tilePickerClasses,
} from "../../components/tile-picker.ts";

/**
 * A row of tiles that share its width, for choosing by look. Its
 * children are <Tile>s, which are plain radios, so it submits with a form
 * and can drive CSS through :has() without JS. Give each picker's tiles
 * the same `name`, and each picker its own.
 */
interface Props extends HTMLFieldsetAttributes {
    /** Accessible name for the group. */
    label: string;
    size?: TilePickerSize;
    /** `joined` puts small previews in one frame; `cards` gives big ones room. */
    variant?: TilePickerVariant;
    disabled?: boolean;
    children?: Snippet;
}

const {
    label,
    size = "default",
    variant = "cards",
    disabled = false,
    class: className,
    children,
    ...rest
}: Props = $props();
</script>

<!-- biome-ignore format: whitespace between the elements is output, and Astro emits none -->
<fieldset
    class={tilePickerClasses({ size, variant, class: className as string })}
    {disabled}
    {...rest}
>
    <legend class="visually-hidden">{label}</legend>{@render children?.()}
</fieldset>
