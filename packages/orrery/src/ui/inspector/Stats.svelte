<script lang="ts">
import { bodyStats } from "../../body-stats.ts";
import { getDocument, getView } from "../../state/context.ts";
import { statRows } from "./stats.ts";

type Props = {
    /** The body whose stats the section lists. */
    id: string;
};

const { id }: Props = $props();

const documents = getDocument();
const view = getView();

const rows = $derived(statRows(bodyStats(documents.system, id, view.now())));
</script>

{#if rows.length > 0}
    <section class="orrery__body-stats">
        <h3>Body</h3>
        <dl class="orrery__stats-grid">
            {#each rows as [label, value] (label)}
                <div>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                </div>
            {/each}
        </dl>
    </section>
{/if}

<style>
.orrery__body-stats {
    margin-block-start: var(--orrery-pad);

    h3 {
        margin: 0 0 6px;
        color: var(--orrery-muted);
        font-size: var(--orrery-size-label);
        font-weight: 500;
    }

    /* The scroll body has its own top padding. */
    &:first-child {
        margin-block-start: 0;
    }
}
</style>
