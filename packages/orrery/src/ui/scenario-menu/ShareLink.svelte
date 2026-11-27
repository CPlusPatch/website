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
