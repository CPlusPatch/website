<script lang="ts">
import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import { initPreviewFrame } from "../../behaviours/preview-frame.ts";
import {
    type PreviewWidth,
    previewFrameClasses,
} from "../../components/preview-frame.ts";

/**
 * A box whose width the reader sets, for trying content at other widths.
 * The children are the content. The width is set by dragging the box's
 * right edge or with the ruler above it, a range input that also takes the
 * keyboard (arrows, PageUp and PageDown). A drag snaps to the named `widths`.
 *
 * Without JS the controls stay hidden and the content fills the width.
 * The props are read once, when the behaviour starts.
 */
interface Props extends HTMLAttributes<HTMLDivElement> {
    /** Named widths in rem: marked on the ruler, and a drag lands on them. */
    widths?: PreviewWidth[];
    /** The narrowest width, in rem. */
    min?: number;
    /** The starting width in rem, or "fill" for the container's. */
    value?: number | "fill";
    /** The ruler's accessible name. */
    label?: string;
    /** Keeps the width for the tab's session under this sessionStorage key. */
    storageKey?: string;
    children?: Snippet;
}

const {
    widths = [],
    min = 20,
    value = "fill",
    label = "Preview width",
    storageKey,
    class: className,
    children,
    ...rest
}: Props = $props();

let root: HTMLDivElement | undefined = $state();

$effect(() => {
    if (root) return initPreviewFrame(root);
});
</script>

<!-- biome-ignore format: Svelte renders whitespace between siblings as text, which Astro doesn't -->
<div
    bind:this={root}
    class={previewFrameClasses({ class: className as string })}
    data-min={min}
    data-value={value}
    data-storage-key={storageKey}
    {...rest}
    ><div class="preview-frame__ruler"
        ><input
            class="preview-frame__range"
            type="range"
            step="any"
            {min}
            aria-label={label}
        ><span class="preview-frame__readout" aria-hidden="true"></span
        >{#each widths as width (width.rem)}<span
                class="preview-frame__tick"
                data-name={width.name}
                data-rem={width.rem}
                aria-hidden="true"
                ><span class="preview-frame__tick-name">{width.name}</span
                ><span>{width.rem} rem</span></span
            >{/each}</div
    ><div class="preview-frame__body"
        ><div class="preview-frame__content">{@render children?.()}</div
        ><div class="preview-frame__edge" aria-hidden="true"></div></div
    ></div
>
