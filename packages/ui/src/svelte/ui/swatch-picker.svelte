<script lang="ts">
import type { HTMLFieldsetAttributes } from "svelte/elements";
import {
    type SwatchOption,
    swatchClasses,
    swatchPickerClasses,
    swatchStyle,
} from "../../components/swatch-picker.ts";

/**
 * A row of colour swatches, as plain radios in a fieldset, so it submits
 * with a form and can drive CSS through :has() without JS. Give each picker
 * its own `name`. An option with an `accent` is drawn as a two-colour swatch.
 */
interface Props extends Omit<HTMLFieldsetAttributes, "name"> {
    name: string;
    /** Accessible name for the group. */
    label: string;
    options: SwatchOption[];
    /** The initially checked option, if any. */
    value?: string;
}

const {
    name,
    label,
    options,
    value,
    class: className,
    ...rest
}: Props = $props();
</script>

<!-- biome-ignore-start lint/a11y/noLabelWithoutControl: the radio is inside the label -->
<fieldset class={swatchPickerClasses(className as string)} {...rest}>
    <legend class="visually-hidden">{label}</legend>
    {#each options as option (option.value)}
        <label
            class={swatchClasses(option)}
            style={swatchStyle(option)}
            title={option.label}
            {...option.attributes}
            ><input
                class="visually-hidden"
                type="radio"
                {name}
                value={option.value}
                checked={option.value === value}
            ><span class="visually-hidden">{option.label}</span></label
        >
    {/each}
</fieldset>
<!-- biome-ignore-end lint/a11y/noLabelWithoutControl: see above -->
