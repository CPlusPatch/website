<script lang="ts">
import { controlRows, type Preview } from "./bench.ts";
import BenchControl from "./bench-control.svelte";
import type { Control, ControlValues } from "./controls.ts";

/**
 * The inspector's controls for a story, a row each (see BenchControl), with
 * an icon and a text control sharing one. Any change calls `onchange` with
 * every control's value, which the bench turns into a query (controlQuery).
 * The widgets need JS to do anything.
 */
type Props = {
    controls: Control[];
    /** The values on stage. */
    values: ControlValues;
    /** What a `preview` choice's tiles draw. */
    preview?: Preview;
    onchange: (values: ControlValues) => void;
};

const { controls, values, preview, onchange }: Props = $props();

const rows = $derived(controlRows(controls));
</script>

{#if controls.length > 0}
    <div class="bench-controls">
        {#each rows as row (row[0]?.key)}
            <div
                class={[
                    "bench-controls__row",
                    row.length > 1 && "bench-controls__row--pair",
                ]}
            >
                {#each row as control (control.key)}
                    <BenchControl
                        {control}
                        value={values[control.key] ?? control.value}
                        {preview}
                        onchange={(value) =>
                            onchange({ ...values, [control.key]: value })}
                    />
                {/each}
            </div>
        {/each}
    </div>
{/if}

<style>
.bench-controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    width: 100%;
    min-width: 0;
}

.bench-controls__row--pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-sm);
}

/* The toolkit's select, input and combobox have no small size; match the small segmented controls. */
.bench-controls :global(.select),
.bench-controls :global(.input),
.bench-controls :global(.combobox__input) {
    height: var(--control-height-sm);
    font-size: var(--font-size-xs);
}
</style>
