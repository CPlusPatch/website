<script lang="ts">
import type { Snippet } from "svelte";
import type {
    HTMLAnchorAttributes,
    HTMLButtonAttributes,
} from "svelte/elements";
import {
    type ButtonSize,
    type ButtonTone,
    type ButtonVariant,
    buttonClasses,
    isAnchor as linkRequested,
} from "../../components/button.ts";

/**
 * Renders an <a> when `as="a"` or an `href` is given, otherwise a <button>.
 * `variant` only changes how it looks, so a `link`-variant button is still
 * a <button>.
 */
type Props = Omit<HTMLButtonAttributes, "type"> &
    Omit<HTMLAnchorAttributes, "type"> & {
        /** Force the element. Defaults to "a" when `href` is set, else "button". */
        as?: "button" | "a";
        type?: "button" | "submit" | "reset";
        variant?: ButtonVariant;
        tone?: ButtonTone;
        size?: ButtonSize;
        children?: Snippet;
    };

const {
    as,
    type,
    variant = "solid",
    tone = "primary",
    size = "default",
    class: className,
    children,
    ...rest
}: Props = $props();

const isAnchor = $derived(linkRequested(as, rest.href));
const classes = $derived(
    buttonClasses({ variant, tone, size, class: className as string }),
);
</script>

{#if isAnchor}
    <!-- biome-ignore lint/a11y/useValidAnchor: href comes from the rest props -->
    <a class={classes} {...rest as HTMLAnchorAttributes}>
        {@render children?.()}
    </a>
{:else}
    <button
        type={type ?? "button"}
        class={classes}
        {...rest as HTMLButtonAttributes}
    >
        {@render children?.()}
    </button>
{/if}
