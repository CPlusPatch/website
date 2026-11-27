<script lang="ts">
import type { Status } from "./status.ts";

type Props = {
    status: Status;
};

/** The most import errors the dialog lists. */
const MAX_SHOWN_ERRORS = 20;

const { status }: Props = $props();
</script>

<div class="orrery__form-hint orrery__scenarios-status" role="status">
    {#if typeof status === "string"}
        {status}
    {:else if status}
        <p>The file isn't a valid scenario:</p>
        <ul>
            {#each status.invalid.slice(0, MAX_SHOWN_ERRORS) as error}
                <li>{error}</li>
            {/each}
            {#if status.invalid.length > MAX_SHOWN_ERRORS}
                <li>and {status.invalid.length - MAX_SHOWN_ERRORS} more</li>
            {/if}
        </ul>
    {/if}
</div>

<style>
/* Not display: none, so the live region still announces. */
.orrery__scenarios-status {
    p {
        margin: 0;
    }

    ul {
        margin: var(--space-xs) 0 0;
        padding-inline-start: var(--space-md);
    }

    &:empty {
        margin-block-start: -0.625rem;
    }
}
</style>
