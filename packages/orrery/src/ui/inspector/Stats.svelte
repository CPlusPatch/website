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

const rows = $derived(
    statRows(bodyStats(documents.doc.scenario, id, view.now())),
);
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
