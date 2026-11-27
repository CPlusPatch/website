<script lang="ts">
import { builtInScenarios } from "@cpluspatch/catalog";
import { type Document, documentOf } from "@cpluspatch/sim";
import { classes } from "./buttons.ts";
import { bodyCount } from "./rows.ts";

type Props = {
    onLoad: (doc: Document) => void;
};

const { onLoad }: Props = $props();
</script>

<h3 class="orrery__scenarios-heading" id="orrery-scenarios-built-in">
    Built in
</h3>
<section aria-labelledby="orrery-scenarios-built-in">
    <ul class="orrery__scenarios-list">
        {#each builtInScenarios as scenario, index}
            <li class="orrery__scenarios-row">
                <div>
                    <strong>{scenario.name}</strong
                    ><small>{bodyCount(scenario)}</small>
                </div>
                <button
                    type="button"
                    class={classes("outline")}
                    data-action="built-in"
                    data-index={index}
                    aria-label="Load {scenario.name}"
                    onclick={() => onLoad(documentOf(scenario))}
                >
                    Load
                </button>
            </li>
        {/each}
    </ul>
</section>

<style>
.orrery__scenarios-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 0.625rem 0;
    border-block-end: 1px solid var(--orrery-rule);

    > div {
        flex: 1;
        min-inline-size: 0;
    }

    strong {
        display: block;
        font-weight: 600;
        overflow-wrap: anywhere;
    }

    > :global(.button) {
        flex: none;
        min-inline-size: var(--scenarios-button-size);
    }

    small {
        color: var(--orrery-muted);
        font: 400 var(--orrery-size-sm) var(--orrery-font-ui);
    }
}

/* Styled like the form labels, so the lists don't outrank the dialog title. */
.orrery__scenarios-heading {
    margin: 0;
    color: var(--orrery-muted);
    font-size: var(--orrery-size-sm);
    font-weight: 600;
}

.orrery__scenarios-list {
    margin: 0 0 var(--space-sm);
    padding: 0;
    border-block-start: 1px solid var(--orrery-rule);
    list-style: none;
}
</style>
