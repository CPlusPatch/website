<script lang="ts">
import { formatDuration, formatRadius, styleOf } from "@cpluspatch/render";
import type { Body } from "@cpluspatch/sim";
import { getDocument } from "../../state/context.ts";
import { facts } from "../../systems.ts";
import { bodyMarker } from "../body-marker.ts";

type Props = {
    body: Body;
    bodies: readonly Body[];
    picked: boolean;
    range: string;
    onact: (act: "pick" | "focus") => void;
};

const { body, bodies, picked, range, onact }: Props = $props();

const documents = getDocument();
const parent = $derived(
    bodies.find((candidate) => candidate.id === body.orbit?.parent),
);
const entries = $derived.by((): [string, string][] => {
    const { period, radius } = facts(bodies, body.id);
    const found: [string, string][] = [];
    if (period !== null) found.push(["Period", formatDuration(period)]);
    if (radius !== null) found.push(["Mean radius", formatRadius(radius)]);

    return found;
});
</script>

<div class="orrery__search-title" data-id={body.id}>
    <span
        class="orrery__search-marker orrery__search-marker--head"
        style:color={documents.colorOf(body, parent)}
        >{@html bodyMarker(body)}</span
    >
    <h2>{body.name}</h2>
    {#if picked}
        <span
            class="orrery__search-picked"
            role="img"
            aria-label="Picked"
        ></span>
    {/if}
    <span class="orrery__search-kind">{styleOf(body).label}</span>
    <span class="orrery__search-range">{range}</span>
</div>
{#if entries.length > 0}
    <dl class="orrery__search-facts">
        {#each entries as [term, value] (term)}
            <div>
                <dt>{term}</dt>
                <dd>{value}</dd>
            </div>
        {/each}
    </dl>
{/if}
<div class="orrery__search-actions">
    <button
        type="button"
        class="orrery__search-button orrery__search-button--pick"
        data-act="pick"
        disabled={picked}
        onclick={() => onact("pick")}
    >
        {picked ? "Picked" : `Pick ${body.name}`}
    </button>
    <button
        type="button"
        class="orrery__search-button"
        data-act="focus"
        onclick={() => onact("focus")}
    >
        Focus camera
    </button>
</div>
