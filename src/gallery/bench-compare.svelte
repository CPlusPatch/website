<script lang="ts">
import SegmentedControl from "@cpluspatch/ui/svelte/ui/segmented-control.svelte";
import type { Backdrop } from "./bench.ts";
import { COMPARE_MODES, type CompareMode, copies } from "./compare.ts";
import { applyStage, fit } from "./fit-frame.ts";
import { followQuery, frameUrl, sendQuery, splitUrl } from "./play-frame.ts";

/**
 * The bench's compare strip: the current pick as copies in a row, in light
 * and dark, in every theme or in every style. Each copy is a frame of the
 * pick's own page, as tall as its page. A new query on a live story's page
 * goes to each copy as a message, so the copies don't reload (play-frame.ts).
 */
type Props = {
    /** The pick's page (pickPath), with its query if it has one. */
    url: string;
    /** The look's URL params. Each copy's own and the query's win over them. */
    params?: Record<string, string>;
    /** The pick's id, for the frames' titles. */
    title: string;
    /** The stage frame's width in px, once known. */
    width: number | null;
    mode: CompareMode;
    onmode: (mode: CompareMode) => void;
};

const { url, params = {}, title, width, mode, onmode }: Props = $props();

let row: HTMLElement | undefined = $state();

const parts = $derived(splitUrl(url));
// Keyed on the path too: a new page needs a new frame, since a new src
// on a loaded one would add a history entry.
const frames = $derived(
    copies(mode).map((copy) => ({
        key: `${copy.label}${parts.path}`,
        label: copy.label,
        params: copy.params,
        path: parts.path,
        query: parts.query,
    })),
);

/** A copy's page: the pick's, with the look, the copy's params and the query. */
const srcOf = (frame: (typeof frames)[number]) =>
    frameUrl(frame.path, { ...params, ...frame.params }, frame.query);

const frameList = () =>
    Array.from(row?.querySelectorAll<HTMLIFrameElement>("iframe") ?? []);

export const setStage = (backdrop: Backdrop, outline: boolean) => {
    for (const frame of frameList()) applyStage(frame, backdrop, outline);
};

// Sets the src once: a later query goes as a message, and a new look as a replace.
const track = (
    frame: HTMLIFrameElement,
    copy: { src: string; query: string; look: string },
) => {
    let { query, look } = copy;
    fit(frame);
    const unfollow = followQuery(frame, () => query);
    frame.src = copy.src;

    return {
        update: (next: { src: string; query: string; look: string }) => {
            const moved = next.look !== look;
            if (!moved && next.query === query) return;

            query = next.query;
            look = next.look;
            if (moved) frame.contentWindow?.location.replace(next.src);
            else sendQuery(frame, query);
        },
        destroy: unfollow,
    };
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
            {#each frames as frame (frame.key)}
                <figure
                    class="bench-compare__copy"
                    style:--copy-width={width ? `${width}px` : "40rem"}
                >
                    <figcaption class="text-meta">{frame.label}</figcaption>
                    <!-- Inert: copies are to look at, and each has a page's landmarks and tab stops. -->
                    <iframe
                        inert
                        title={`${frame.label}: ${title}`}
                        loading="lazy"
                        use:track={{
                            src: srcOf(frame),
                            query: frame.query,
                            look: JSON.stringify(params),
                        }}
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
