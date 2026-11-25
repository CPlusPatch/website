<script lang="ts">
import { tick } from "svelte";
import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";
import { removalNote } from "../../adding.ts";
import { cue } from "../../audio/cues.ts";
import { getDocument, getView } from "../../state/context.ts";

type Props = {
    id: string;
    name: string;
    hasParent: boolean;
    hasOrbit: boolean;
    openForm: (mode: "edit" | "burn") => void;
};

const { id, name, hasParent, hasOrbit, openForm }: Props = $props();

const documents = getDocument();
const view = getView();

let foot: HTMLElement | undefined;
let edit = $state.raw<HTMLButtonElement>();
let burn = $state.raw<HTMLButtonElement>();
let cancel = $state.raw<HTMLButtonElement>();
let removeButton = $state.raw<HTMLButtonElement>();
let confirming = $state(false);

const note = $derived(
    confirming ? removalNote(documents.doc.scenario, id) : "",
);

/** Moves the focus to the Edit or Burn button that opened a form. */
export const focusOpener = (opener: "edit" | "burn") => {
    (opener === "edit" ? edit : burn)?.focus();
};

const ask = async () => {
    confirming = true;
    await tick();
    cancel?.focus();
};

const back = async () => {
    confirming = false;
    await tick();
    removeButton?.focus();
};

const remove = async () => {
    // Selecting the parent changes `id`.
    const target = id;
    const root = foot?.closest<HTMLElement>(".orrery");
    const parent = documents.doc.scenario.bodies.find(
        (candidate) => candidate.id === target,
    )?.parent;

    cue("remove");
    // The parent stays selected, so its card is the one that replaces this.
    if (parent) view.select(parent);

    const result = documents.dispatch({ type: "remove-body", id: target });
    if (!result.ok) throw new Error(result.errors.join(" "));

    // This card is gone, so the new one takes focus.
    await tick();
    root?.querySelector<HTMLElement>(".orrery__orbit-focus")?.focus();
};

// A native listener, as the shortcut that clears the selection would see a delegated one too late.
const backOnEscape: Attachment<HTMLElement> = (node) =>
    on(node, "keydown", (event) => {
        if (!confirming || event.key !== "Escape") return;

        // The shortcut that clears the selection skips a handled key.
        event.preventDefault();
        event.stopPropagation();
        void back();
    });

const focused = $derived(view.focus === id);
</script>

<div
    class={[
        "orrery__inspector-foot",
        confirming && "orrery__inspector-foot--confirm",
    ]}
    {...confirming
        ? { role: "group", "aria-labelledby": "orrery-orbit-confirm-title" }
        : {}}
    bind:this={foot}
    {@attach backOnEscape}
>
    {#if confirming}
        <div class="orrery__foot-question">
            <p
                class="orrery__foot-question-title"
                id="orrery-orbit-confirm-title"
            >
                Remove {name}?
            </p>
            {#if note}
                <p class="orrery__foot-question-note">{note}</p>
            {/if}
        </div>
        <button
            type="button"
            class="orrery__foot-button"
            bind:this={cancel}
            onclick={back}
        >
            Cancel
        </button>
        <button
            type="button"
            class="orrery__foot-button orrery__foot-button--danger"
            onclick={remove}
        >
            Remove
        </button>
    {:else}
        <button
            type="button"
            class="orrery__foot-button orrery__orbit-focus"
            aria-pressed={focused}
            onclick={() => view.setFocus(id)}
        >
            {focused ? "Focused" : "Focus"}
        </button>
        {#if hasOrbit}
            <button
                type="button"
                class="orrery__foot-button"
                bind:this={edit}
                onclick={() => openForm("edit")}
            >
                Edit
            </button>
            <button
                type="button"
                class="orrery__foot-button"
                bind:this={burn}
                onclick={() => openForm("burn")}
            >
                Burn
            </button>
        {/if}
        {#if hasParent}
            <button
                type="button"
                class="orrery__foot-remove"
                bind:this={removeButton}
                onclick={ask}
            >
                Remove
            </button>
        {/if}
    {/if}
</div>
