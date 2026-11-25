<script lang="ts">
import type { Units } from "@cpluspatch/render";
import { HEIGHT, type PlateData, plateView, WIDTH } from "./plate.ts";

type Props = {
    units: Units;
    bodyName: string;
    parentName: string;
    data: PlateData;
};

const { units, bodyName, parentName, data }: Props = $props();

const view = $derived(plateView(data));
</script>

<figure class="orrery__plate" class:orrery__plate--still={view.still}>
    <svg
        viewBox="0 0 {WIDTH} {HEIGHT}"
        role="img"
        aria-label="Orbit of {bodyName} around {parentName}, to scale."
    >
        <ellipse
            fill="none"
            stroke="var(--orrery-pick)"
            stroke-width="1.5"
            cx={view.orbit.cx}
            cy={view.orbit.cy}
            rx={view.orbit.rx}
            ry={view.orbit.ry}
            transform={view.orbit.transform}
        />
        <line
            stroke="var(--orrery-dim)"
            stroke-dasharray="3 3"
            x1={view.apsides.x1}
            y1={view.apsides.y1}
            x2={view.apsides.x2}
            y2={view.apsides.y2}
        />
        <line
            stroke="var(--orrery-text)"
            stroke-width="1"
            x1={view.radius.x1}
            y1={view.radius.y1}
            x2={view.radius.x2}
            y2={view.radius.y2}
        />
        <circle
            cx={view.parent.cx}
            cy={view.parent.cy}
            r={view.parent.r}
            fill={view.parent.fill}
        />
        {#each [
            ["Pe", view.periapsis],
            ["Ap", view.apoapsis],
        ] as const as [name, apsis] (name)}
            <rect
                width="5"
                height="5"
                fill="var(--orrery-signal)"
                x={apsis.marker.x}
                y={apsis.marker.y}
            />
            <g transform="translate({apsis.badge.x} {apsis.badge.y})">
                <rect
                    width="18"
                    height="15"
                    x="-9"
                    y="-7.5"
                    fill="var(--orrery-signal)"
                />
                <!-- The baseline sits 4 units below the badge centre. -->
                <text class="orrery__plate-badge" text-anchor="middle" y="4">
                    {name}
                </text>
            </g>
        {/each}
        <circle
            r="7.5"
            fill="none"
            stroke="var(--orrery-pick)"
            stroke-width="1.25"
            cx={view.body.cx}
            cy={view.body.cy}
        />
        <circle
            r="4"
            stroke="var(--orrery-ground)"
            stroke-width="1.5"
            cx={view.body.cx}
            cy={view.body.cy}
            fill={view.body.fill}
        />
        <polygon fill="var(--orrery-text)" points={view.arrow} />
    </svg>
    <div class="orrery__plate-legend" aria-hidden="true">
        {#each [
            ["Pe", view.legend.periapsis],
            ["Ap", view.legend.apoapsis],
        ] as const as [name, row] (name)}
            <div class="orrery__plate-apsis">
                <span class="orrery__plate-name">{name}</span>
                <span class="orrery__plate-altitude">{row.altitude}</span>
                <span class="orrery__plate-time">{row.time ?? ""}</span>
            </div>
        {/each}
    </div>
    <div
        class="orrery__plate-scale"
        style:--plate-bar-y={view.scale.barY}
        style:--plate-bar-px={view.scale.barPx}
    >
        <span class="orrery__plate-bar"></span>
        <span aria-hidden="true">{view.scale.text}</span>
        <button
            type="button"
            class="orrery__unit-switch"
            aria-label={view.unitLabel}
            onclick={() => units.toggle(view.unit)}
        >
            {view.unit}
        </button>
    </div>
</figure>
