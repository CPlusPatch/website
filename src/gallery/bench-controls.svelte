<script lang="ts">
import Input from "@cpluspatch/ui/svelte/ui/input.svelte";
import SegmentedControl from "@cpluspatch/ui/svelte/ui/segmented-control.svelte";
import Select from "@cpluspatch/ui/svelte/ui/select.svelte";
import Toggle from "@cpluspatch/ui/svelte/ui/toggle.svelte";
import { ICONS } from "../../packages/ui/src/icons.ts";
import { type Control, type ControlValues, MAX_TEXT } from "./controls.ts";

/**
 * The inspector's controls for a story, one widget per kind: a segmented
 * control (or a select when the values don't fit the column) for a choice,
 * a toggle for a boolean, an input for text and a select for an icon. Any
 * change calls `onchange` with every control's value, which the bench turns
 * into a query (controlQuery). Text commits on Enter or blur, since each
 * change is a history entry. The widgets are plain, so this needs JS to do
 * anything.
 */
type Props = {
    controls: Control[];
    /** The values on stage. */
    values: ControlValues;
    onchange: (values: ControlValues) => void;
};

const { controls, values, onchange }: Props = $props();

// Five tones overflow the inspector at 1280px wide.
const MAX_SEGMENTS = 4;

const ICON_OPTIONS = [
    { value: "", label: "None" },
    ...Object.keys(ICONS).map((name) => ({
        value: `lucide:${name}`,
        label: name,
    })),
];

const read = (event: Event) => {
    const root = event.currentTarget as HTMLElement;
    const picked = { ...values };
    for (const { key, kind } of controls) {
        const name = `bench-control-${key}`;
        const input = root.querySelector<HTMLInputElement | HTMLSelectElement>(
            `select[name="${name}"], input[name="${name}"]:is([type="text"], [type="checkbox"], [type="radio"]:checked)`,
        );
        if (!input) continue;

        picked[key] =
            kind === "boolean" && input instanceof HTMLInputElement
                ? input.checked
                : input.value;
    }

    onchange(picked);
};
</script>

{#if controls.length > 0}
    <div class="bench-controls" onchange={read}>
        {#each controls as control (control.key)}
            {@const name = `bench-control-${control.key}`}
            <div class="bench-controls__item">
                <span
                    class="bench-controls__label text-meta"
                    aria-hidden="true"
                >
                    {control.key}
                </span>
                {#if control.kind === "choice"}
                    {#if control.values.length > MAX_SEGMENTS}
                        <Select
                            {name}
                            label={control.key}
                            options={control.values.map((value) => ({
                                value,
                                label: value,
                            }))}
                            value={String(values[control.key])}
                        />
                    {:else}
                        <SegmentedControl
                            {name}
                            label={control.key}
                            options={control.values.map((value) => ({
                                value,
                                label: value,
                            }))}
                            value={String(values[control.key])}
                            size="sm"
                            variant="subtle"
                        />
                    {/if}
                {:else if control.kind === "boolean"}
                    <Toggle
                        {name}
                        label={control.key}
                        checked={values[control.key] === true}
                    />
                {:else if control.kind === "text"}
                    <Input
                        {name}
                        label={control.key}
                        maxlength={MAX_TEXT}
                        value={String(values[control.key])}
                    />
                {:else}
                    <Select
                        {name}
                        label={control.key}
                        options={ICON_OPTIONS}
                        value={String(values[control.key])}
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

/* The toolkit's select and input have no small size; match the small segmented controls. */
.bench-controls :global(.select),
.bench-controls :global(.input) {
    height: var(--control-height-sm);
    font-size: var(--font-size-xs);
}

.bench-controls__label {
    font-family: var(--font-mono);
}
</style>
