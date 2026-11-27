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

<style>
/*
 * The to-scale orbit, in two columns: the drawing, and the apsides legend with the scale bar.
 * One drawing unit is 64cqw / 224, so the bar and the legend line up with it in CSS.
 */
.orrery__plate {
    --plate-unit: calc(64cqw / 224);
    --plate-line: 1.125rem;
    --plate-legend: calc(4 * var(--plate-line) + var(--space-sm));
    /* The orbit's centre in the drawing, which is the middle of the 158 unit viewBox. */
    --plate-mid: calc(79 * var(--plate-unit));
    --plate-gap: var(--space-sm);
    position: relative;
    display: grid;
    flex: none;
    grid-template-columns: auto minmax(0, 1fr);
    column-gap: var(--plate-gap);
    container-type: inline-size;
    margin: 0;
    /* A wide sheet would scale the plate up with cqw, so it keeps the card's size. */
    padding-inline-end: max(0px, calc(100% - var(--orrery-side-width)));
    background: var(--orrery-ground);

    /* No times, so the legend is two lines shorter. */
    &.orrery__plate--still {
        --plate-legend: calc(2 * var(--plate-line) + var(--space-sm));
    }

    svg {
        display: block;
        inline-size: 64cqw;
        block-size: auto;
    }
}

.orrery__plate-badge {
    fill: var(--orrery-signal-ink);
    font: 600 12px var(--orrery-font-ui);
}

.orrery__plate-legend {
    display: grid;
    align-self: center;
    gap: var(--space-sm);
    padding-inline-end: var(--orrery-pad);
    white-space: nowrap;
    font-weight: 400;
    line-height: var(--plate-line);
}

.orrery__plate-apsis {
    display: grid;
    grid-template-columns: 1.375rem auto;
    justify-content: start;
    font-size: var(--orrery-size-sm);
}

.orrery__plate-name,
.orrery__plate-time {
    color: var(--orrery-muted);
    font-family: var(--orrery-font-ui);
}

.orrery__plate-altitude {
    font-family: var(--orrery-font-data);
    font-variant-numeric: tabular-nums;
}

.orrery__plate-time {
    grid-column: 2;
}

.orrery__plate--still .orrery__plate-time {
    display: none;
}

/* On the bottom of the orbit, but clear of the centred legend and the plate's edge. */
.orrery__plate-scale {
    position: absolute;
    inset-inline-start: calc(64cqw + var(--plate-gap));
    inset-block-start: min(
        max(
            calc(var(--plate-bar-y) * var(--plate-unit)),
            calc(var(--plate-mid) + var(--plate-legend) / 2 + 0.875rem)
        ),
        calc(158 * var(--plate-unit) - 0.75rem)
    );
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    transform: translateY(-50%);
    color: var(--orrery-muted);
    font: 400 var(--orrery-size-label) / 1.2 var(--orrery-font-data);

    .orrery__unit-switch {
        min-block-size: 1.5rem;
    }
}

.orrery__plate-bar {
    flex: none;
    box-sizing: border-box;
    inline-size: calc(var(--plate-bar-px) * var(--plate-unit));
    block-size: 7px;
    border-inline: 1px solid currentColor;
    background:
        linear-gradient(currentColor, currentColor) center / 100% 1px no-repeat;
}

@media (max-width: 720px) {
    /* A touch target. The hit area of the small control reaches past its box. */
    .orrery__plate-scale .orrery__unit-switch {
        position: relative;

        &::before {
            content: "";
            position: absolute;
            inset: 50% auto auto 50%;
            inline-size: var(--control-height-md);
            block-size: var(--control-height-md);
            transform: translate(-50%, -50%);
        }
    }
}
</style>
