<script lang="ts">
import {
    type AUnit,
    formatAngle,
    formatDistance,
    formatDuration,
    formatSpeed,
} from "@cpluspatch/render";
import type { Readouts } from "@cpluspatch/sim";
import { spoken } from "./readouts.ts";

type Props = {
    parentName: string;
    current: Readouts;
    /** The unit the reader chose, or `null` while the distance picks its own. */
    unit: AUnit | null;
};

const { parentName, current, unit }: Props = $props();

const cells = $derived<[string, string][]>([
    ["Speed", formatSpeed(current.speed)],
    ["Period", formatDuration(current.period)],
    ["True anomaly", formatAngle(current.trueAnomaly)],
]);
</script>

<div class="orrery__inspector-headline">
    <p class="orrery__headline-now">
        <span class="orrery__headline-distance"
            >{formatDistance(current.distance, unit)}</span
        ><span class="orrery__headline-from">from {parentName}</span>
    </p>
    <dl class="orrery__stats-grid orrery__headline-grid">
        {#each cells as [label, value] (label)}
            <div>
                <dt>{label}</dt>
                <dd><span>{value}</span></dd>
            </div>
        {/each}
    </dl>
    <p class="visually-hidden" aria-live="off">{spoken(current, unit)}</p>
</div>
