<script lang="ts">
import SegmentedControl from "@cpluspatch/ui/svelte/ui/segmented-control.svelte";
import type { Backdrop } from "./bench.ts";
import { COMPARE_MODES, type CompareMode, copies, copyUrl } from "./compare.ts";
import { applyStage, fit } from "./fit-frame.ts";

/**
 * The bench's compare strip: the current pick as copies in a row, in light
 * and dark, in every theme or in every style. Each copy is a frame of the
 * pick's own page, as tall as its page.
 */
type Props = {
    /** The pick's page (pickPath). */
    url: string;
    /** The pick's id, for the frames' titles. */
    title: string;
    /** The stage frame's width in px, once known. */
    width: number | null;
    mode: CompareMode;
    onmode: (mode: CompareMode) => void;
};

const { url, title, width, mode, onmode }: Props = $props();

let row: HTMLElement | undefined = $state();

const frames = $derived(
    copies(mode).map((copy) => ({
        label: copy.label,
        src: copyUrl(url, copy.params),
    })),
);

const frameList = () =>
    Array.from(row?.querySelectorAll<HTMLIFrameElement>("iframe") ?? []);

/** Loads every copy again, for a changed Display choice. */
export const reload = () => {
    for (const frame of frameList()) frame.contentWindow?.location.reload();
};

export const setStage = (backdrop: Backdrop, outline: boolean) => {
    for (const frame of frameList()) applyStage(frame, backdrop, outline);
};

const track = (frame: HTMLIFrameElement) => {
    fit(frame);
};
</script>

<section class="bench-compare" aria-label="Compare">
    <div class="bench-compare__header">
        <span class="bench-compare__label text-meta" aria-hidden="true">
            Compare
        </span>
        <div
            onchange={(event) =>
                onmode((event.target as HTMLInputElement).value as CompareMode)}
        >
            <SegmentedControl
                name="bench-compare"
                label="Compare"
                options={COMPARE_MODES}
                value={mode}
                size="sm"
                variant="subtle"
            />
        </div>
    </div>
    {#if frames.length}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <!-- biome-ignore-start lint/a11y/useSemanticElements: a fieldset is a form control -->
        <!-- biome-ignore-start lint/a11y/noNoninteractiveTabindex: a keyboard can scroll it -->
        <div
            class="bench-compare__row"
            role="group"
            aria-label="Copies"
            tabindex="0"
            bind:this={row}
        >
            <!-- Keyed on the src: a new src on a loaded frame would add a history entry. -->
            {#each frames as frame (frame.src)}
                <figure
                    class="bench-compare__copy"
                    style:--copy-width={width ? `${width}px` : "40rem"}
                >
                    <figcaption class="text-meta">{frame.label}</figcaption>
                    <!-- Inert: copies are to look at, and each has a page's landmarks and tab stops. -->
                    <iframe
                        inert
                        title={`${frame.label}: ${title}`}
                        src={frame.src}
                        loading="lazy"
                        use:track
                    ></iframe>
                </figure>
            {/each}
        </div>
        <!-- biome-ignore-end lint/a11y/noNoninteractiveTabindex: a keyboard can scroll it -->
        <!-- biome-ignore-end lint/a11y/useSemanticElements: a fieldset is a form control -->
    {/if}
</section>

<style>
.bench-compare {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    min-width: 0;
    padding: var(--space-md);
    border-block-start: var(--border-width) solid var(--border-color);
}

.bench-compare__header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm);
}

.bench-compare__row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-md);
    /* To the column's edges, so a copy at the stage's Fill width fits whole. */
    margin-inline: calc(-1 * var(--space-md));
    padding-inline: var(--space-xs);
    padding-block-end: var(--space-sm);
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: var(--space-xs);
}

.bench-compare__copy {
    display: flex;
    flex: none;
    scroll-snap-align: start;
    flex-direction: column;
    gap: var(--space-xs);
    margin: 0;

    iframe {
        display: block;
        box-sizing: border-box;
        width: var(--copy-width);
        /* Until the page loads and fit() sizes it. */
        height: 12rem;
        border: var(--border-width) solid var(--border-color);
        background-color: var(--color-surface);
    }
}
</style>
