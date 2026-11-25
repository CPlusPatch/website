<script lang="ts">
import { unixMsToJ2000s } from "@cpluspatch/orbit";
import {
    type DateParts,
    formatYear,
    fromParts,
    PART_NAMES,
    type PartName,
    parsePasted,
    partsProblem,
    stepPart,
    toParts,
} from "@cpluspatch/render";
import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { flushSync, onDestroy, untrack } from "svelte";
import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";
import { getDocument, getView } from "../../state/context.ts";
import {
    cleanSegment,
    isFull,
    SEGMENTS,
    segmentAction,
    segmentNumber,
} from "./segments.ts";

type Props = {
    /** The button that toggles the editor. It gets `aria-expanded`, and the focus when the editor closes. */
    opener: HTMLButtonElement | undefined;
};

const J2000_TEXT = "2000-01-01 12:00";

const { opener }: Props = $props();

const documents = getDocument();
const view = getView();

const outline = buttonClasses({
    variant: "outline",
    tone: "neutral",
    size: "sm",
    class: "orrery__small-button",
}).join(" ");

let element: HTMLElement | undefined;
const inputs: Partial<Record<PartName, HTMLInputElement>> = {};

let open = $state(false);
let errorText = $state("");
let invalid = $state<PartName | null>(null);

// The clock holds while the editor is open. `touched` means the user ran or held it since.
let openedT = 0;
let savedPaused = false;
let touched = false;

const neighbour = (name: PartName, by: -1 | 1) =>
    inputs[PART_NAMES[PART_NAMES.indexOf(name) + by] ?? name];

const fill = (parts: DateParts) => {
    for (const name of PART_NAMES) {
        const input = inputs[name];
        if (!input) continue;

        const value = parts[name];

        input.value =
            name === "y"
                ? formatYear(value)
                : String(value).padStart(SEGMENTS[name].digits, "0");
    }
    invalid = null;
    errorText = "";
};

const read = (): DateParts => {
    const number = (name: PartName) =>
        segmentNumber(name, inputs[name]?.value ?? "");

    return {
        y: number("y"),
        mo: number("mo"),
        d: number("d"),
        h: number("h"),
        mi: number("mi"),
        s: number("s"),
    };
};

const openEditor = () => {
    openedT = view.now();
    fill(toParts(openedT));
    savedPaused = view.clock.paused;
    touched = false;
    // The segment can only take focus once the editor shows.
    flushSync(() => {
        open = true;
    });
    if (!view.clock.paused) view.setClock({ paused: true });
    inputs.d?.focus();
};

const close = () => {
    if (!open) return;

    // Hiding the editor would drop focus to <body>.
    const held = element?.contains(document.activeElement);
    open = false;
    if (!touched && view.clock.paused !== savedPaused) {
        view.setClock({ paused: savedPaused });
    }
    if (held) opener?.focus();
};

// An editor that goes with the page still gives back the clock it held.
onDestroy(close);

/** Opens the editor, or closes it if it's open. */
export const toggle = () => (open ? close() : openEditor());

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
    else neighbour(name, action === "before" ? -1 : 1)?.focus();
};

const onInput = (name: PartName) => {
    const input = inputs[name];
    if (!input) return;

    input.value = cleanSegment(name, input.value);
    if (invalid === name) invalid = null;
    errorText = "";
    if (isFull(name, input.value) && name !== PART_NAMES.at(-1))
        neighbour(name, 1)?.focus();
};

const onPaste = (event: ClipboardEvent) => {
    const parts = parsePasted(event.clipboardData?.getData("text") ?? "");
    if (!parts) return;

    event.preventDefault();
    fill(parts);
};

const submit = (event: SubmitEvent) => {
    event.preventDefault();

    const parts = read();
    const problem = partsProblem(parts);
    if (problem) {
        invalid = problem.part;
        errorText = problem.message;
        inputs[problem.part]?.focus();

        return;
    }

    view.setClock({ t: fromParts(parts) });
    close();
};

// A native listener, as the shortcut that clears the selection would see a delegated one too late.
const closeOnEscape: Attachment<HTMLElement> = (node) =>
    on(node, "keydown", (event) => {
        if (event.key !== "Escape") return;

        event.stopPropagation();
        close();
    });

$effect(() => {
    opener?.setAttribute("aria-expanded", String(open));
});

// A load replaces the clock too, so the editor has nothing to set.
$effect(() => {
    void documents.loads;

    untrack(close);
});

$effect(() => {
    void view.clock.sets;

    untrack(() => {
        if (open && !view.clock.paused) touched = true;
    });
});
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

{#snippet preset(
    label: string,
    onclick: () => void,
    iso?: string,
)}
    <button type="button" class={outline} {onclick}>
        {label}
        {#if iso}
            <small class="orrery__date-iso">{iso}</small>
        {/if}
    </button>
{/snippet}

<section
    id="orrery-date-editor"
    class="orrery__date-editor"
    aria-labelledby="orrery-date-title"
    hidden={!open}
    bind:this={element}
    {@attach closeOnEscape}
>
    <div class="orrery__inspector-head orrery__inspector-head--panel">
        <h2 class="orrery__panel-title" id="orrery-date-title">Set the date</h2>
        <button
            type="button"
            class={buttonClasses({
                variant: "ghost",
                tone: "neutral",
                size: "icon-sm",
            }).join(" ")}
            aria-label="Close"
            onclick={close}
        >
            {@html iconSvg("x")}
        </button>
    </div>
    <form class="orrery__date-form" novalidate onsubmit={submit}>
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
        <p
            class="orrery__stepper-error"
            id="orrery-date-error"
            hidden={!errorText}
        >
            {errorText}
        </p>
        <p class="orrery__date-hint">Arrow keys step the part you're in.</p>
        <!-- biome-ignore lint/a11y/useSemanticElements: A <fieldset> would change the DOM and its styles. -->
        <div class="orrery__date-presets" role="group" aria-label="Presets">
            {@render preset("Now", () =>
                fill(toParts(unixMsToJ2000s(Date.now()))),
            )}
            {@render preset("J2000", () => fill(toParts(0)), J2000_TEXT)}
            {@render preset("Reset", () => fill(toParts(openedT)))}
        </div>
        <div class="orrery__date-actions">
            <button
                type="button"
                class={buttonClasses({
                    variant: "outline",
                    tone: "neutral",
                }).join(" ")}
                onclick={close}
            >
                Cancel
            </button>
            <button type="submit" class={buttonClasses().join(" ")}>
                Go to date
            </button>
        </div>
    </form>
</section>
