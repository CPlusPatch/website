<script lang="ts">
import { RESULTS_HINT, TREE_HINT } from "./nav.ts";

type Props = {
    /** The hint lists the keys of a query's matches, not those of the tree. */
    searching: boolean;
};

const { searching }: Props = $props();

const hint = $derived(searching ? RESULTS_HINT : TREE_HINT);
</script>

<p class="orrery__search-hint">
    {#each hint as [symbol, label, action], index (symbol)}
        {#if index > 0}
            <span class="orrery__search-sep" aria-hidden="true">·</span>
        {/if}
        <span class="orrery__search-keyhint">
            <kbd class="orrery__search-key" aria-label={label}>{symbol}</kbd>
            {action}
        </span>
    {/each}
</p>

<style>
.orrery__search-hint {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.5rem;
    margin: 0;
    padding: 0.5rem var(--orrery-pad);
    border-block-start: 1px solid var(--orrery-rule);
    color: var(--orrery-dim);
    font-size: var(--orrery-size-label);
}

.orrery__search-keyhint {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
}

.orrery__search-key {
    padding: 0 5px;
    border: 1px solid var(--orrery-frame);
    background-color: var(--orrery-panel-raised);
    color: var(--orrery-muted);
    font: 400 var(--orrery-size-xs) / 1.4 var(--orrery-font-data);
}

@media (max-width: 720px) {
    .orrery__search-hint {
        display: none;
    }
}
</style>
