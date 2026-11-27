<script lang="ts">
import { onMount } from "svelte";
import { fit } from "./fit-frame.ts";

/**
 * The bench's stage: one page of stories in a frame, grown to its height.
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
    <iframe
        bind:this={frame}
        name="stage"
        title={`Stage: ${title}`}
        src={initial}
    ></iframe>
</div>

<style>
/* At least the column's height; fit() grows the frame past it for a tall story. */
.bench-stage {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    min-width: 0;

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
