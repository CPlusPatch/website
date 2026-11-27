<script lang="ts">
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";

type Props = {
    /** Moves the clock to the next periapsis or apoapsis, and pauses it. */
    goTo: (apsis: "periapsis" | "apoapsis") => void;
};

const { goTo }: Props = $props();
</script>

<div class="orrery__burn-actions">
    <button
        type="button"
        class={buttonClasses({ variant: "outline", tone: "neutral" }).join(" ")}
        onclick={() => goTo("periapsis")}
    >
        Go to periapsis
    </button><button
        type="button"
        class={buttonClasses({ variant: "outline", tone: "neutral" }).join(" ")}
        onclick={() => goTo("apoapsis")}
    >
        Go to apoapsis
    </button>
</div>

<style>
/* Equal columns, so buttons that wrap still line up. */
.orrery__burn-actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    margin-block-start: var(--space-md);
    gap: var(--space-xs);
}

/* A wrapped label spills out of the fixed-height button. */
.orrery__burn-actions :global(.button) {
    white-space: nowrap;
}
</style>
