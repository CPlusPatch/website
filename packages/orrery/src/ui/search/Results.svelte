<script lang="ts">
import type { Body } from "@cpluspatch/sim";
import type { Attachment } from "svelte/attachments";
import Row from "./Row.svelte";

type Props = {
    bodies: readonly Body[];
    /** The bodies that match `query`. */
    hits: readonly Body[];
    query: string;
    active: string | null;
    picked: string | null;
    /** False until the panel has been opened once, as the lists start empty. */
    built: boolean;
    searching: boolean;
    /** True while the list holds an option. */
    listed: boolean;
    range: (id: string) => string;
    results?: HTMLElement;
    /** Fades the foot of a scrolling list while more rows are below. */
    more: Attachment<HTMLElement>;
    onpick: (id: string, andFocus: boolean) => void;
};

let {
    bodies,
    hits,
    query,
    active,
    picked,
    built,
    searching,
    listed,
    range,
    results = $bindable(),
    more,
    onpick,
}: Props = $props();
</script>

<!-- biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is on only while the list holds an option -->
<div
    id="orrery-search-results"
    class="orrery__search-results"
    tabindex="-1"
    role={listed ? "listbox" : undefined}
    aria-label={listed ? "Matching bodies" : undefined}
    bind:this={results}
    {@attach more}
>
    {#if built && searching}
        {#each hits as hit (hit.id)}
            <Row
                body={hit}
                {bodies}
                pane="hit"
                active={hit.id === active}
                {query}
                picked={hit.id === picked}
                range={range(hit.id)}
                onrow={(event) => onpick(hit.id, event.shiftKey)}
            />
        {:else}
            <p class="orrery__search-nomatch">
                No body named “{query.trim()}”.
            </p>
        {/each}
    {/if}
</div>

<style>
.orrery__search-results {
    grid-column: 1 / -1;
    grid-row: 1;
    min-block-size: 0;
    overflow-y: auto;
    overscroll-behavior: contain;

    /* Fades the foot of a list while more rows are below. */
    &:global([data-more]) {
        mask-image: linear-gradient(
            to bottom,
            #000 calc(100% - 1.5rem),
            transparent
        );
    }
}

.orrery__search-nomatch {
    margin: 0;
    padding: 1rem var(--orrery-pad);
    color: var(--orrery-muted);
}
</style>
