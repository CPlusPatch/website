<script lang="ts">
import { classes } from "./buttons.ts";
import type { Status } from "./status.ts";

type Props = {
    /** The link to copy. Empty while it's being made. */
    link: string;
    onStatus: (status: Status) => void;
};

const { link, onStatus }: Props = $props();

let input: HTMLInputElement | undefined;

const copyLink = async () => {
    try {
        await navigator.clipboard.writeText(link);
        onStatus("Copied the link.");
    } catch {
        input?.select();
        onStatus(
            "Couldn't copy. The link is selected, so copy it with your keyboard.",
        );
    }
};
</script>

<div class="orrery__form-row">
    <label for="orrery-scenario-link">Share link</label>
    <div class="orrery__stepper">
        <input
            bind:this={input}
            id="orrery-scenario-link"
            type="text"
            readonly
            class="orrery__scenarios-link"
            value={link}
        >
        <button
            type="button"
            class={classes("outline")}
            disabled={link === ""}
            onclick={copyLink}
        >
            Copy
        </button>
    </div>
</div>

<style>
/* The stepper class is doubled in this file to outrank the shared rules in forms.css. */

/* The text fields here are left-aligned, unlike the number steppers. */
.orrery__stepper.orrery__stepper input {
    text-align: start;
    font: 500 var(--orrery-size-md) var(--orrery-font-ui);
}

/* The link is long, so it's one muted line cut with an ellipsis. */
.orrery__stepper.orrery__stepper input.orrery__scenarios-link {
    color: var(--orrery-muted);
    font: 400 var(--orrery-size-sm) var(--orrery-font-data);
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* On a phone the buttons are taller than the field, so it grows with them. */
.orrery__stepper.orrery__stepper {
    block-size: auto;
    min-block-size: var(--orrery-control-lg);
}

/* The same width, so the Save and Copy rows line up. */
.orrery__stepper.orrery__stepper > :global(.button) {
    block-size: auto;
    min-inline-size: var(--scenarios-button-size);
    border-width: 0 0 0 1px;
    border-color: var(--orrery-frame);
}
</style>
