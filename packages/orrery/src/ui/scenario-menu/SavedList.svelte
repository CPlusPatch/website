<script lang="ts">
import type { Document } from "@cpluspatch/sim";
import { classes } from "./buttons.ts";
import { type SavedRow, savedMeta } from "./rows.ts";

type Props = {
    /** The saved scenarios, newest first. */
    rows: SavedRow[];
    /** The index of the Delete button waiting for its second press. */
    armed: number | null;
    onLoad: (doc: Document) => void;
    onPressDelete: (index: number) => void;
};

const { rows, armed, onLoad, onPressDelete }: Props = $props();
</script>

<h3 class="orrery__scenarios-heading" id="orrery-scenarios-saved">Saved</h3>
<section aria-labelledby="orrery-scenarios-saved">
    {#if rows.length === 0}
        <p class="orrery__scenarios-empty">Nothing saved yet.</p>
    {:else}
        <ul class="orrery__scenarios-list">
            {#each rows as { entry, index } (entry)}
                {@const entryName = entry.doc.scenario.name}
                <li class="orrery__scenarios-row">
                    <div>
                        <strong>{entryName}</strong
                        ><small>{savedMeta(entry)}</small>
                    </div>
                    <button
                        type="button"
                        class={classes("outline")}
                        data-action="load"
                        data-index={index}
                        aria-label="Load {entryName}"
                        onclick={() => onLoad(entry.doc)}
                    >
                        Load
                    </button>
                    <button
                        type="button"
                        class={classes(
                            "ghost",
                            "orrery__scenarios-quiet orrery__orbit-quiet",
                        )}
                        data-action="delete"
                        data-index={index}
                        aria-label={armed === index
                            ? `Confirm deleting ${entryName}`
                            : `Delete ${entryName}`}
                        onclick={() => onPressDelete(index)}
                    >
                        {armed === index ? "Confirm" : "Delete"}
                    </button>
                </li>
            {/each}
        </ul>
    {/if}
</section>

<style>
/* The small-button rules in forms.css set its padding, font and phone height. */
.orrery__orbit-quiet {
    flex: none;
    border: 0;
    background: none;
    color: var(--orrery-muted);
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;

    @media (hover: hover) {
        &:hover {
            color: var(--orrery-text);
        }
    }
}
</style>
