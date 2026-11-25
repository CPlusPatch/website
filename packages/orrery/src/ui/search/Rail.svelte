<script lang="ts">
import { AU } from "@cpluspatch/orbit";
import {
    type AUnit,
    colorOf,
    formatRange,
    listUnit,
    styleOf,
} from "@cpluspatch/render";
import type { Body } from "@cpluspatch/sim";
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
        style:--orrery-rail-colour={colorOf(body, parent)}
    ></i>
    {#each scale.marks as { body: child, at } (child.id)}
        <i
            class={[
                "orrery__search-rail-mark",
                styleOf(child).craft && "orrery__search-rail-mark--craft",
            ]}
            style:--at={String(at)}
            style:--orrery-rail-colour={colorOf(child, body)}
            data-active={child.id === active ? "" : undefined}
        ></i>
    {/each}
</div>
<div class="orrery__search-rail-labels">
    {#each labelled as { distance, at }, index (index)}
        <span style:--at={String(at)}>{formatRange(distance, unit)}</span>
    {/each}
</div>
