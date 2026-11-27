<script lang="ts">
import {
    type DateParts,
    PART_NAMES,
    type PartName,
    parsePasted,
    stepPart,
} from "@cpluspatch/render";
import {
    cleanSegment,
    movesOn,
    partBeside,
    partText,
    readParts,
    SEGMENTS,
    segmentAction,
} from "./segments.ts";

type Props = {
    /** The part that holds a value the editor refused. */
    invalid: PartName | null;
    /** Called when the parts change: with the part that was typed in, or none when all were set. */
    onEdit: (name?: PartName) => void;
};

const { invalid, onEdit }: Props = $props();

const inputs: Partial<Record<PartName, HTMLInputElement>> = {};

/** Puts `parts` in the inputs. */
export const fill = (parts: DateParts) => {
    for (const name of PART_NAMES) {
        const input = inputs[name];
        if (input) input.value = partText(name, parts[name]);
    }
    onEdit();
};

/** The parts as typed. A part that isn't a number reads as `NaN`. */
export const read = (): DateParts =>
    readParts((name) => inputs[name]?.value ?? "");

/** Moves the focus to part `name`. */
export const focus = (name: PartName) => inputs[name]?.focus();

const step = (name: PartName, by: number) => {
    const next = stepPart(read(), name, by);
    if (!next) return;

    fill(next);
    inputs[name]?.select();
};

const onKeydown = (event: KeyboardEvent, name: PartName) => {
    // Ctrl+- zooms the page out.
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const input = inputs[name];
    if (!input) return;

    const action = segmentAction(event.key, name, {
        value: input.value,
        start: input.selectionStart,
        end: input.selectionEnd,
    });
    if (!action) return;

    event.preventDefault();
    if (action === "up") step(name, 1);
    else if (action === "down") step(name, -1);
    else focus(partBeside(name, action === "before" ? -1 : 1));
};

const onInput = (name: PartName) => {
    const input = inputs[name];
    if (!input) return;

    input.value = cleanSegment(name, input.value);
    onEdit(name);
    if (movesOn(name, input.value)) focus(partBeside(name, 1));
};

const onPaste = (event: ClipboardEvent) => {
    const parts = parsePasted(event.clipboardData?.getData("text") ?? "");
    if (!parts) return;

    event.preventDefault();
    fill(parts);
};
</script>

{#snippet segment(
    name: PartName,
)}
    <input
        class="orrery__date-part"
        data-part={name}
        aria-label={SEGMENTS[name].label}
        aria-invalid={invalid === name ? "true" : undefined}
        inputmode={name === "y" ? "text" : "numeric"}
        maxlength={SEGMENTS[name].digits + (name === "y" ? 1 : 0)}
        autocomplete="off"
        bind:this={inputs[name]}
        onfocus={() => inputs[name]?.select()}
        onkeydown={(event) => onKeydown(event, name)}
        oninput={() => onInput(name)}
        onpaste={onPaste}
    >
{/snippet}

{#snippet separator(
    text: string,
)}
    <span class="orrery__date-sep" aria-hidden="true">{text}</span>
{/snippet}

<!-- biome-ignore lint/a11y/useSemanticElements: A <fieldset> would change the DOM and its styles. -->
<div
    class="orrery__date-entry"
    role="group"
    aria-label="Date and time, UTC"
    aria-describedby="orrery-date-error"
>
    {@render segment("y")}
    {@render separator("-")}
    {@render segment("mo")}
    {@render separator("-")}
    {@render segment("d")}
    <span class="orrery__date-gap" aria-hidden="true"></span>
    {@render segment("h")}
    {@render separator(":")}
    {@render segment("mi")}
    {@render separator(":")}
    {@render segment("s")}
    <span class="orrery__date-utc">UTC</span>
</div>

<style>
.orrery__date-entry {
    display: flex;
    align-items: center;
    block-size: 40px;
    padding: 0 8px;
    border: 1px solid var(--orrery-control-frame);
    background-color: var(--orrery-ground);
    color: var(--orrery-dim);
    font: 400 var(--orrery-size-md) var(--orrery-font-data);

    &:focus-within {
        outline: 2px solid var(--orrery-text);
        outline-offset: 1px;
    }

    &:has([aria-invalid="true"]) {
        border-color: var(--orrery-abort);
    }
}

.orrery__date-sep {
    padding-inline: 1px;
}

.orrery__date-gap {
    inline-size: 14px;
}

.orrery__date-utc {
    margin-inline-start: auto;
    color: var(--orrery-muted);
    font: 600 var(--orrery-size-xs) var(--orrery-font-ui);
}

.orrery__date-part {
    inline-size: calc(2ch + 6px);
    min-inline-size: 0;
    padding: 4px 3px;
    border: 0;
    outline: none;
    background: none;
    color: var(--orrery-text);
    font: inherit;
    font-variant-numeric: tabular-nums;
    text-align: center;
    caret-color: var(--orrery-go);

    &[data-part="y"] {
        inline-size: calc(5ch + 6px);
    }

    &:focus {
        background-color: var(--orrery-panel-raised);
    }

    &::selection {
        background-color: var(--orrery-text);
        color: var(--orrery-ground);
    }

    &[aria-invalid="true"] {
        color: var(--orrery-abort);
    }
}
</style>
