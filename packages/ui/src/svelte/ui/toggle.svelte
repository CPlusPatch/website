<script lang="ts">
import type { Snippet } from "svelte";
import type { HTMLLabelAttributes } from "svelte/elements";
import { toggleClasses } from "../../components/toggle.ts";

/**
 * A switch built on a native checkbox, so it works and submits without JS.
 * Visible text, if any, is the children and sits after the switch.
 */
interface Props extends HTMLLabelAttributes {
    /**
     * Accessible name. Without text it is the only name the switch has;
     * with text, keep the two the same.
     */
    label: string;
    checked?: boolean;
    disabled?: boolean;
    name?: string;
    value?: string;
    children?: Snippet;
}

const {
    label,
    checked = false,
    disabled = false,
    name,
    value,
    class: className,
    children,
    ...rest
}: Props = $props();

const hasText = $derived(children != null);
</script>

<!-- biome-ignore-start lint/a11y/useAriaPropsForRole: A native checkbox exposes its own checked state, so the switch role needs no aria-checked -->
<label
    class={toggleClasses({ text: hasText, class: className as string })}
    {...rest}
    ><input
        type="checkbox"
        role="switch"
        aria-label={label}
        class="toggle__input"
        {checked}
        {disabled}
        {name}
        {value}
    ><span class="toggle__slider" aria-hidden="true"></span>
    {#if children}
        <span class="toggle__text text-ui" aria-hidden="true"
            >{@render children()}</span
        >
    {/if}</label
>
<!-- biome-ignore-end lint/a11y/useAriaPropsForRole: see above -->
