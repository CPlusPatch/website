<script lang="ts">
import ControlRow from "@cpluspatch/ui/svelte/ui/control-row.svelte";
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
    /** Prefix of the control names. Unique among the settings in a page. */
    name?: string;
};

const { stage, outline, onstage, onoutline, name = "bench" }: Props = $props();

const BACKDROPS: { value: Backdrop; label: string }[] = [
    { value: "plain", label: "Plain" },
    { value: "dots", label: "Dots" },
    { value: "surface", label: "Surface" },
];
</script>

<div class="bench-settings">
    <ControlRow
        label="Backdrop"
        value={BACKDROPS.find((b) => b.value === stage)?.label}
        onchange={(event) =>
            onstage((event.target as HTMLInputElement).value as Backdrop)}
    >
        <SegmentedControl
            name={`${name}-backdrop`}
            label="Backdrop"
            options={BACKDROPS}
            value={stage}
            size="sm"
            variant="subtle"
        />
    </ControlRow>
    <ControlRow
        label="Outline boxes"
        value={outline ? "On" : "Off"}
        onchange={(event) =>
            onoutline((event.target as HTMLInputElement).checked)}
    >
        <Toggle
            label="Outline boxes"
            name={`${name}-outline`}
            checked={outline}
        />
    </ControlRow>
</div>

<style>
.bench-settings {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    min-width: 0;
}
</style>
