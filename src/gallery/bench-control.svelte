<script lang="ts">
import Combobox from "@cpluspatch/ui/svelte/ui/combobox.svelte";
import ControlRow from "@cpluspatch/ui/svelte/ui/control-row.svelte";
import Input from "@cpluspatch/ui/svelte/ui/input.svelte";
import SegmentedControl from "@cpluspatch/ui/svelte/ui/segmented-control.svelte";
import Select from "@cpluspatch/ui/svelte/ui/select.svelte";
import SwatchPicker from "@cpluspatch/ui/svelte/ui/swatch-picker.svelte";
import Toggle from "@cpluspatch/ui/svelte/ui/toggle.svelte";
import { ICONS } from "../../packages/ui/src/icons.ts";
import type { Preview } from "./bench.ts";
import BenchTiles from "./bench-tiles.svelte";
import { type Control, MAX_TEXT } from "./controls.ts";

/**
 * One control of a story's: its prop's name and value on a line, and the
 * widget for its kind below. A choice is a segmented control (or a select
 * when the values don't fit the column), or what its `widget` says; a
 * boolean is a toggle, text an input and an icon a combobox. `onchange` is
 * called with the new value. Text commits on Enter or blur, since each
 * change is a history entry.
 */
type Props = {
    control: Control;
    /** The value on stage. */
    value: string | boolean;
    /** What a `preview` choice's tiles draw. */
    preview?: Preview;
    onchange: (value: string | boolean) => void;
};

const { control, value, preview, onchange }: Props = $props();

// Five tones overflow the inspector at 1280px wide.
const MAX_SEGMENTS = 4;

const ICON_OPTIONS = [
    { value: "", label: "None" },
    ...Object.keys(ICONS).map((name) => ({
        value: `lucide:${name}`,
        label: name,
        icon: `lucide:${name}`,
    })),
];

const name = $derived(`bench-control-${control.key}`);
// A text control has no readout, since the field says it, and neither has an icon.
const readout = $derived(
    control.kind === "text" || control.kind === "icon"
        ? undefined
        : String(value),
);

const choices = $derived(
    control.kind === "choice"
        ? control.values.map((v) => ({ value: v, label: v }))
        : [],
);
const swatches = $derived(
    choices.map((option) => ({
        ...option,
        color: `var(--color-${option.value})`,
    })),
);

// The native widgets' changes bubble up from the radios, select, checkbox and input.
const read = (event: Event) => {
    const input = event.target as HTMLInputElement | HTMLSelectElement;

    onchange(
        input instanceof HTMLInputElement && input.type === "checkbox"
            ? input.checked
            : input.value,
    );
};
</script>

<!-- The combobox reports its picks itself: its typing would be a change here. -->
<ControlRow
    label={control.key}
    mono
    value={readout}
    onchange={control.kind === "icon" ? undefined : read}
>
    {#if control.kind === "choice"}
        {#if control.widget === "swatches"}
            <SwatchPicker
                {name}
                label={control.key}
                options={swatches}
                value={String(value)}
            />
        {:else if control.widget === "sizes" ||
            (control.widget === "preview" && preview)}
            <BenchTiles
                {name}
                label={control.key}
                prop={control.key}
                values={control.values}
                value={String(value)}
                widget={control.widget}
                {preview}
            />
        {:else if control.values.length > MAX_SEGMENTS}
            <Select
                {name}
                label={control.key}
                options={choices}
                value={String(value)}
            />
        {:else}
            <SegmentedControl
                {name}
                label={control.key}
                options={choices}
                value={String(value)}
                size="sm"
                variant="subtle"
            />
        {/if}
    {:else if control.kind === "boolean"}
        <Toggle {name} label={control.key} checked={value === true} />
    {:else if control.kind === "text"}
        <Input
            {name}
            label={control.key}
            maxlength={MAX_TEXT}
            spellcheck="false"
            value={String(value)}
        />
    {:else}
        <Combobox
            {name}
            label={control.key}
            options={ICON_OPTIONS}
            value={String(value)}
            placeholder="None"
            class="bench-combobox"
            onchange={(picked) => onchange(picked)}
        />
    {/if}
</ControlRow>

<style>
/* The icon field sits at the inspector's start edge, so its list may be as wide as the inspector's content. */
:global(.bench-combobox .combobox__listbox) {
    max-inline-size: 18rem;
}
</style>
