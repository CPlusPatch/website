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
