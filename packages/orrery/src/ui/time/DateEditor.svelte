<script lang="ts">
import { unixMsToJ2000s } from "@cpluspatch/orbit";
import {
    type DateParts,
    fromParts,
    type PartName,
    partsProblem,
    toParts,
} from "@cpluspatch/render";
import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { flushSync, onDestroy, untrack } from "svelte";
import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";
import { getDocument, getView } from "../../state/context.ts";
import DateEntry from "./DateEntry.svelte";

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
let entry = $state.raw<ReturnType<typeof DateEntry>>();

let open = $state(false);
let errorText = $state("");
let invalid = $state<PartName | null>(null);

// The clock holds while the editor is open. `touched` means the user ran or held it since.
let openedT = 0;
let savedPaused = false;
let touched = false;

const edited = (name?: PartName) => {
    if (!name || invalid === name) invalid = null;
    errorText = "";
};

const fill = (parts: DateParts) => entry?.fill(parts);

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
    entry?.focus("d");
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

const submit = (event: SubmitEvent) => {
    event.preventDefault();

    const parts = entry?.read();
    if (!parts) return;

    const problem = partsProblem(parts);
    if (problem) {
        invalid = problem.part;
        errorText = problem.message;
        entry?.focus(problem.part);

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
        <DateEntry bind:this={entry} {invalid} onEdit={edited} />
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

<style>
.orrery__date-editor {
    position: absolute;
    z-index: 3;
    inset-block-end: calc(100% + 8px);
    inset-inline-start: 50%;
    translate: -50% 0;
    inline-size: min(340px, 100% - 2 * var(--space-sm));
    border: 1px solid var(--orrery-frame);
    background-color: var(--orrery-panel-solid);
}

.orrery__date-form {
    display: grid;
    gap: 0.625rem;
    padding: 0 var(--orrery-pad) var(--orrery-pad);
}

.orrery__date-hint {
    margin: 0;
    color: var(--orrery-dim);
    font-size: var(--orrery-size-xs);

    @media (pointer: coarse) {
        display: none;
    }
}

.orrery__date-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.orrery__date-iso {
    color: var(--orrery-muted);
    font: 400 var(--orrery-size-xs) var(--orrery-font-data);
    white-space: nowrap;
}

.orrery__date-actions {
    display: flex;
    gap: var(--space-sm);
    margin-block-start: 0.25rem;

    :global(.button) {
        flex: 1;
    }
}

/* With a side panel open, the editor stops at its edge. 170px is half its width. */
@media (min-width: 721px) {
    :global(.orrery:has(.orrery__panel--right > :not([hidden])))
        .orrery__date-editor {
        --half: min(170px, calc(50% - var(--space-sm)));

        inset-inline-start: max(
            calc(var(--half) + var(--space-sm)),
            min(50%, 100% - var(--orrery-side-width) - var(--half))
        );
    }
}

@media (max-width: 720px) {
    .orrery__date-editor {
        inset-inline: 0;
        translate: none;
        inline-size: auto;
    }
}
</style>
