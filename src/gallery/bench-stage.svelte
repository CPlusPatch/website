<script lang="ts">
import PreviewFrame from "@cpluspatch/ui/svelte/ui/preview-frame.svelte";
import { onMount } from "svelte";
import type { Backdrop } from "./bench.ts";
import { fit } from "./fit-frame.ts";
import { PREVIEW_SNAPS } from "./widths.ts";

/**
 * The bench's stage: one page of stories in a frame, grown to its height,
 * and as wide as the reader sets it (the preview frame's edge or ruler).
 * A new `url` moves the frame with location.replace(), so it adds no
 * history entry of its own. Without JS the frame stays on its first url.
 */
type Props = {
    url: string;
    /** Names what's on the stage, for the frame's title. */
    title: string;
    /** A story link in the page, as its hash. True if handled. */
    onhashlink?: (hash: string) => boolean;
};

const { url, title, onhashlink }: Props = $props();

let frame: HTMLIFrameElement | undefined = $state();
// The src stays the first url: later ones go through location.replace().
// svelte-ignore state_referenced_locally
const initial = url;
let shown = initial;

/** Loads the page in the frame again, for a changed Display choice. */
export const reload = () => frame?.contentWindow?.location.reload();

export const setStage = (backdrop: Backdrop, outline: boolean) => {
    const root = frame?.contentDocument?.documentElement;
    if (!root) return;

    if (backdrop === "plain") delete root.dataset.galleryStage;
    else root.dataset.galleryStage = backdrop;
    if (outline) root.dataset.galleryOutline = "";
    else delete root.dataset.galleryOutline;
};

onMount(() => {
    if (frame)
        fit(frame, { onHashLink: (hash) => onhashlink?.(hash) ?? false });
});

$effect(() => {
    if (url === shown) return;
    shown = url;
    frame?.contentWindow?.location.replace(url);
});
</script>

<div class="bench-stage">
    <PreviewFrame
        class="bench-stage__frame"
        widths={PREVIEW_SNAPS}
        storageKey="gallery-preview-width"
    >
        <iframe
            bind:this={frame}
            name="stage"
            title={`Stage: ${title}`}
            src={initial}
        ></iframe>
    </PreviewFrame>
</div>

<style>
/*
 * At least the column's height; fit() grows the frame past it for a tall story.
 * A dot grid shows beside a narrowed frame, as a flat surface is too close
 * to most stories' backgrounds to mark where the frame ends.
 */
.bench-stage {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    min-width: 0;
    background-color: var(--color-surface);

    :global(.bench-stage__frame) {
        flex: 1 0 auto;
    }

    :global(.preview-frame__body) {
        background-image: radial-gradient(
            var(--color-border-strong) 1px,
            transparent 1px
        );
        background-size: var(--space-md) var(--space-md);
    }

    /* The frame's content is as tall as the stage, for the iframe to fill. */
    :global(.preview-frame__content) {
        display: flex;
        flex-direction: column;
    }

    iframe {
        display: block;
        flex: 1 0 auto;
        width: 100%;
        min-height: var(--bench-stage-min, 0);
        /* Until the page loads and fit() sizes it. */
        height: 20rem;
        border: 0;
    }
}
</style>
