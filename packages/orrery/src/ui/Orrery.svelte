<script lang="ts">
import type { Attachment } from "svelte/attachments";
import {
    type Opened,
    openScenario,
    type SavedStorage,
} from "../persistence.ts";
import { showLoadFailed } from "./load-failed.ts";
import Shell from "./Shell.svelte";

/** The browser's `localStorage`, which can throw on any access. */
const storage: SavedStorage = {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
};

let live: HTMLElement | undefined;
let started = $state.raw<{ root: HTMLElement; opened: Opened } | null>(null);

// Replaces the text, so a message that repeats is announced again.
const announce = (text: string) => {
    if (live) live.textContent = text;
};

// The region is there from the start, so it finds the page's `.orrery` and starts the Orrery.
const start: Attachment<HTMLElement> = (node) => {
    const root = node.closest<HTMLElement>(".orrery");
    if (!root) throw new Error("The Orrery needs a .orrery element.");

    let cancelled = false;
    openScenario(location.hash, storage).then(
        (opened) => {
            if (!cancelled) started = { root, opened };
        },
        (error) => {
            showLoadFailed(root);

            throw error;
        },
    );

    return () => {
        cancelled = true;
    };
};
</script>

{#if started}
    <Shell root={started.root} opened={started.opened} {storage} {announce} />
{/if}
<!-- Made before the view, so a screen reader watches it before its text changes. -->
<div
    class="visually-hidden"
    aria-live="polite"
    aria-atomic="true"
    bind:this={live}
    {@attach start}
></div>
