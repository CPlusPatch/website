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
