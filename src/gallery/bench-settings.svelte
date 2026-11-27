<script lang="ts">
import SegmentedControl from "@cpluspatch/ui/svelte/ui/segmented-control.svelte";
import Toggle from "@cpluspatch/ui/svelte/ui/toggle.svelte";
import type { Backdrop } from "./bench.ts";

/**
 * The stage's settings: what the stories stand on, and outlines on every
 * box in them. The bench keeps them and applies them in the frame.
 */
type Props = {
    stage: Backdrop;
    outline: boolean;
    onstage: (stage: Backdrop) => void;
    onoutline: (outline: boolean) => void;
};

const { stage, outline, onstage, onoutline }: Props = $props();
</script>

<div class="bench-settings">
    <div class="bench-settings__item">
        <span class="bench-settings__label text-meta" aria-hidden="true">
            Backdrop
        </span>
        <div
            onchange={(event) =>
                onstage((event.target as HTMLInputElement).value as Backdrop)}
        >
            <SegmentedControl
                name="bench-backdrop"
                label="Backdrop"
                options={[
                    { value: "plain", label: "Plain" },
                    { value: "dots", label: "Dots" },
                    { value: "surface", label: "Surface" },
                ]}
                value={stage}
                size="sm"
                variant="subtle"
            />
        </div>
    </div>
    <Toggle
        label="Outline boxes"
        name="bench-outline"
        checked={outline}
        onchange={(event) =>
            onoutline((event.target as HTMLInputElement).checked)}
    >
        Outline boxes
    </Toggle>
</div>

<style>
.bench-settings {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-sm);
    min-width: 0;
    max-width: 100%;
}

.bench-settings__item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xs);
    min-width: 0;
    max-width: 100%;
}
</style>
