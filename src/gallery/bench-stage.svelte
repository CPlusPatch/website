<script lang="ts">
import PreviewFrame from "@cpluspatch/ui/svelte/ui/preview-frame.svelte";
import { onMount } from "svelte";
import type { Backdrop } from "./bench.ts";
import { applyStage, fit } from "./fit-frame.ts";
import { followQuery, sendQuery, splitUrl } from "./play-frame.ts";
import { PREVIEW_SNAPS } from "./widths.ts";

/**
 * The bench's stage: one page of stories in a frame, grown to its height,
 * and as wide as the reader sets it (the preview frame's edge or ruler).
 * A new `url` moves the frame with location.replace(), so it adds no
 * history entry of its own. A new query on the page already shown goes to
 * the page as a message instead, so a live story changes without a reload
 * (play-frame.ts). Without JS the frame stays on its first url.
 */
type Props = {
    url: string;
    /** Names what's on the stage, for the frame's title. */
    title: string;
    /** A story link in the page, as its hash. True if handled. */
    onhashlink?: (hash: string) => boolean;
    /** The frame's width in px, when it changes. */
    onwidth?: (px: number) => void;
};

const { url, title, onhashlink, onwidth }: Props = $props();

let frame: HTMLIFrameElement | undefined = $state();
// The src stays the first url: later ones go through location.replace() or a message.
// svelte-ignore state_referenced_locally
const initial = url;
let shown = splitUrl(initial);

/** Loads the page in the frame again, for a changed Display choice. */
export const reload = () => frame?.contentWindow?.location.reload();

export const setStage = (backdrop: Backdrop, outline: boolean) =>
    applyStage(frame, backdrop, outline);

onMount(() => {
    if (!frame) return;

    fit(frame, { onHashLink: (hash) => onhashlink?.(hash) ?? false });
    const unfollow = followQuery(frame, () => shown.query);

    // The compare strip's copies follow the frame's width.
    const observer = new ResizeObserver(() =>
        onwidth?.(Math.round(frame?.getBoundingClientRect().width ?? 0)),
    );
    observer.observe(frame);

    return () => {
        observer.disconnect();
        unfollow();
    };
});

$effect(() => {
    const next = splitUrl(url);
    if (next.path === shown.path && next.query === shown.query) return;

    const samePage = next.path === shown.path;
    shown = next;
    if (!frame) return;

    if (samePage) sendQuery(frame, next.query);
    else frame.contentWindow?.location.replace(url);
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
 * At least the column's height (less with the compare strip, which follows);
 * fit() grows the frame past it for a tall story.
 * A dot grid shows beside a narrowed frame, as a flat surface is too close
 * to most stories' backgrounds to mark where the frame ends.
 */
.bench-stage {
    display: flex;
    flex-direction: column;
    min-height: var(--bench-stage-height, 100%);
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
