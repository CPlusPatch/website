<script lang="ts">
import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import {
    controlRowClasses,
    controlRowLabelClasses,
} from "../../components/control-row.ts";

/**
 * A setting in an inspector: the label at the start of a line and a readout
 * at its end, the control (the children) below. It adds no behaviour:
 * point `for` at the control's id, or use `labelId` for the control's
 * `aria-labelledby`.
 */
interface Props extends HTMLAttributes<HTMLDivElement> {
    label: string;
    /** The control's current value, as text. */
    value?: string;
    /** Shown in place of `value`, in the muted colour. */
    note?: string;
    /** Id of the note, for the control's `aria-describedby`. */
    noteId?: string;
    /** The id of the control. The label is then a <label>, else a <span>. */
    for?: string;
    /** Id of the label <span>, for the control's `aria-labelledby`. */
    labelId?: string;
    /** Dims the control, not the header. Disable the control itself too. */
    disabled?: boolean;
    /** Sets the label in the mono face, for names from code like a prop. */
    mono?: boolean;
    children?: Snippet;
}

const {
    label,
    value,
    note,
    noteId,
    for: controlId,
    labelId,
    disabled = false,
    mono = false,
    class: className,
    children,
    ...rest
}: Props = $props();

const labelClass = $derived(controlRowLabelClasses(mono));
</script>

<!-- biome-ignore format: whitespace between the elements is output, and Astro emits none -->
<div
    class={controlRowClasses({ disabled, class: className as string })}
    {...rest}
>
    <div class="control-row__header">
        {#if controlId}
            <label class={labelClass} for={controlId}>{label}</label>
        {:else}
            <span class={labelClass} id={labelId}>{label}</span>
        {/if}
        {#if note}
            <span class="control-row__note" id={noteId}>{note}</span>
        {:else if value}
            <!-- The control says its own value. -->
            <span class="control-row__value" aria-hidden="true">{value}</span>
        {/if}
    </div
    ><div class="control-row__control">{@render children?.()}</div>
</div>
