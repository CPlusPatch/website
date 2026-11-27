<script lang="ts">
import { AU } from "@cpluspatch/orbit";
import { type AUnit, formatRange, listUnit, styleOf } from "@cpluspatch/render";
import type { Body } from "@cpluspatch/sim";
import { getDocument } from "../../state/context.ts";
import { rail } from "../../systems.ts";
import { named } from "./nav.ts";

type Props = {
    body: Body;
    bodies: readonly Body[];
    /** The rail's metres, from `rail()` with no unit. */
    metres: NonNullable<ReturnType<typeof rail>>;
    /** The row the keyboard is on in the right pane, if any. */
    active: string | null;
    /** The unit the user picked, or null for automatic. */
    chosen: AUnit | null;
};

const { body, bodies, metres, active, chosen }: Props = $props();

const documents = getDocument();
const unit = $derived(listUnit([metres.lo, metres.hi], chosen));
// Ticks on powers of ten of the shown unit, so AU labels read 1 and 10, not 0.6685.
const scale = $derived(
    unit === "AU" ? (rail(bodies, body.id, AU) ?? metres) : metres,
);
const current = $derived(
    scale.marks.find(({ body: child }) => child.id === active)?.body,
);
const parent = $derived(
    bodies.find((candidate) => candidate.id === body.orbit?.parent),
);
// Without decades, the ends label the range, or the one distance when they match.
const labelled = $derived(
    scale.ticks.length > 0
        ? scale.ticks
        : scale.lo === scale.hi
          ? [{ distance: scale.lo, at: 0.5 }]
          : [
                { distance: scale.lo, at: 0 },
                { distance: scale.hi, at: 1 },
            ],
);
</script>

<div class="orrery__search-rail-cap">
    {#if current?.orbit}
        <b>{current.name}</b>
        · orbit
        <span class="orrery__search-rail-data"
            >{formatRange(Math.abs(current.orbit.elements.a), unit)}</span
        >
    {:else}
        Orbit size around {named(body)}, log scale
    {/if}
</div>
<div class="orrery__search-rail-track">
    {#each scale.ticks as { at }, index (index)}
        <i class="orrery__search-rail-grid" style:--at={String(at)}></i>
    {/each}
    <i
        class="orrery__search-rail-primary"
        style:--orrery-rail-colour={documents.colorOf(body, parent)}
    ></i>
    {#each scale.marks as { body: child, at } (child.id)}
        <i
            class={[
                "orrery__search-rail-mark",
                styleOf(child).craft && "orrery__search-rail-mark--craft",
            ]}
            style:--at={String(at)}
            style:--orrery-rail-colour={documents.colorOf(child, body)}
            data-active={child.id === active ? "" : undefined}
        ></i>
    {/each}
</div>
<div class="orrery__search-rail-labels">
    {#each labelled as { distance, at }, index (index)}
        <span style:--at={String(at)}>{formatRange(distance, unit)}</span>
    {/each}
</div>

<style>
.orrery__search-rail-cap {
    min-block-size: 1.1rem;
    overflow: hidden;
    color: var(--orrery-muted);
    font-size: var(--orrery-size-label);
    text-overflow: ellipsis;
    white-space: nowrap;

    b {
        color: var(--orrery-text);
        font-weight: 600;
    }
}

.orrery__search-rail-data {
    font-family: var(--orrery-font-data);
}

.orrery__search-rail-track {
    position: relative;
    block-size: 2.75rem;
    margin-block-start: 0.125rem;
    /* Half the primary, so its left edge lines up with the caption. */
    margin-inline-start: 11px;

    &::before {
        content: "";
        position: absolute;
        inset-block-start: 50%;
        inset-inline: 0;
        border-block-start: 1px solid var(--orrery-frame);
    }

    i {
        position: absolute;
        inset-block-start: 50%;
        transform: translate(-50%, -50%);
    }
}

/* Each mark, gridline and label sits at its --at, from 0 to 1 along the free part of the track. */
.orrery__search-rail-mark,
.orrery__search-rail-grid,
.orrery__search-rail-labels span {
    inset-inline-start: calc(
        var(--orrery-rail-start) +
        var(--at) *
        (100% - var(--orrery-rail-start) - var(--orrery-rail-end))
    );
}

.orrery__search-rail-primary {
    inset-inline-start: 0;
    inline-size: 22px;
    block-size: 22px;
    border-radius: 50%;
    background-color: var(--orrery-rail-colour);
}

.orrery__search-rail-mark {
    background-color: var(--orrery-rail-colour);
    inline-size: 12px;
    block-size: 12px;
    border-radius: 50%;

    &[data-active] {
        z-index: 2;
        outline: 2px solid var(--orrery-text);
        outline-offset: 2px;
    }
}

.orrery__search-rail-mark--craft {
    inline-size: 3px;
    block-size: 20px;
    border-radius: 0;
}

.orrery__search-rail-track .orrery__search-rail-grid {
    inset-block: 0;
    inline-size: 1px;
    background-color: var(--orrery-rule);
    transform: translateX(-50%);
}

.orrery__search-rail-labels {
    position: relative;
    block-size: 1.1rem;
    margin-inline-start: 0.75rem;
    color: var(--orrery-dim);
    font: 400 var(--orrery-size-xs) var(--orrery-font-data);

    span {
        position: absolute;
        inset-block-start: 0;
        transform: translateX(-50%);
        white-space: nowrap;
    }
}

@media (forced-colors: active) {
    /* Forced colours would turn the marks into the page colour, and they'd vanish. */
    .orrery__search-rail-primary,
    .orrery__search-rail-mark {
        forced-color-adjust: none;
        background-color: CanvasText;
    }

    .orrery__search-rail-mark[data-active] {
        outline-color: Highlight;
    }

    .orrery__search-rail-track::before {
        border-color: CanvasText;
    }

    .orrery__search-rail-track .orrery__search-rail-grid {
        forced-color-adjust: none;
        background-color: GrayText;
    }
}
</style>
