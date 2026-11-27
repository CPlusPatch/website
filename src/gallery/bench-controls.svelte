<script lang="ts">
import SegmentedControl from "@cpluspatch/ui/svelte/ui/segmented-control.svelte";
import Select from "@cpluspatch/ui/svelte/ui/select.svelte";
import type { BenchStory } from "./bench.ts";

/**
 * The inspector's controls for a story: one segmented control per
 * controlled prop, or a select when its values don't fit the column. Picking a value calls `onchange` with every prop's value,
 * which the bench turns into a combination (comboOf). The radios are plain,
 * so this needs JS to do anything.
 */
type Props = {
    story: BenchStory;
    /** The combination on stage, or null for the story's own. */
    combo: string | null;
    onchange: (values: Record<string, string>) => void;
};

const { story, combo, onchange }: Props = $props();

const values = $derived(
    (combo && story.combos[combo]?.values) ||
        Object.fromEntries(story.controls.map((c) => [c.prop, c.value])),
);

// Five tones overflow the inspector at 1280px wide.
const MAX_SEGMENTS = 4;

const read = (event: Event) => {
    const root = event.currentTarget as HTMLElement;
    const picked = { ...values };
    for (const { prop } of story.controls) {
        const input = root.querySelector<HTMLInputElement | HTMLSelectElement>(
            `select[name="bench-control-${prop}"], input[name="bench-control-${prop}"]:checked`,
        );
        if (input) picked[prop] = input.value;
    }

    onchange(picked);
};
</script>

{#if story.controls.length > 0}
    <div class="bench-controls" onchange={read}>
        {#each story.controls as control (control.prop)}
            <div class="bench-controls__item">
                <span
                    class="bench-controls__label text-meta"
                    aria-hidden="true"
                >
                    {control.prop}
                </span>
                {#if control.values.length > MAX_SEGMENTS}
                    <Select
                        name={`bench-control-${control.prop}`}
                        label={control.prop}
                        options={control.values.map((value) => ({
                            value,
                            label: value,
                        }))}
                        value={values[control.prop]}
                    />
                {:else}
                    <SegmentedControl
                        name={`bench-control-${control.prop}`}
                        label={control.prop}
                        options={control.values.map((value) => ({
                            value,
                            label: value,
                        }))}
                        value={values[control.prop]}
                        size="sm"
                        variant="subtle"
                    />
                {/if}
            </div>
        {/each}
    </div>
{/if}

<style>
.bench-controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    min-width: 0;
    max-width: 100%;
}

.bench-controls__item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xs);
    min-width: 0;
    max-width: 100%;
}

/* The toolkit's select has no small size; match the small segmented controls. */
.bench-controls :global(.select) {
    height: var(--control-height-sm);
    font-size: var(--font-size-xs);
}

.bench-controls__label {
    font-family: var(--font-mono);
}
</style>
