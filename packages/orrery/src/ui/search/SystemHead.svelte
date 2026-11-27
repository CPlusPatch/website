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

<style>
.orrery__search-title {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);

    h2 {
        margin: 0;
        font-size: var(--orrery-size-lg);
        font-weight: 600;
        line-height: 1.2;
    }
}

.orrery__search-marker {
    display: flex;
    flex: none;
    /* The title aligns on the name's baseline. */
    align-self: center;
    inline-size: 20px;
    block-size: 20px;

    :global(svg) {
        inline-size: 100%;
        block-size: 100%;
    }
}

.orrery__search-kind {
    color: var(--orrery-muted);
    font-size: var(--orrery-size-sm);
}

.orrery__search-range {
    flex: none;
    margin-inline-start: auto;
    padding-inline-start: var(--space-sm);
    color: var(--orrery-muted);
    font: 400 var(--orrery-size-sm) var(--orrery-font-data);
    font-variant-numeric: tabular-nums;
    text-align: end;
    white-space: nowrap;
}

.orrery__search-picked {
    flex: none;
    align-self: center;
    inline-size: 7px;
    block-size: 7px;
    border-radius: 50%;
    background-color: var(--orrery-pick);
}

.orrery__search-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.5rem;
    margin: var(--space-sm) 0 0;

    div {
        display: flex;
        flex-direction: column;
    }

    dt {
        color: var(--orrery-muted);
        font-size: var(--orrery-size-xs);
    }

    dd {
        margin: 0;
        font: 400 var(--orrery-size-sm) var(--orrery-font-data);
    }
}

.orrery__search-actions {
    display: flex;
    gap: var(--space-sm);
    margin-block-start: 0.625rem;
}

.orrery__search-button {
    block-size: var(--orrery-control);
    padding: 0 var(--orrery-pad);
    border: 1px solid var(--orrery-frame);
    border-radius: 0;
    background: none;
    color: inherit;
    font: 500 var(--orrery-size-sm) var(--orrery-font-ui);
    cursor: pointer;

    &:hover {
        background-color: var(--orrery-panel-raised);
    }

    @media (pointer: coarse), (max-width: 720px) {
        block-size: var(--control-height-sm);
    }
}

.orrery__search-button--pick {
    border-color: var(--orrery-pick);
    background-color: var(--orrery-pick);
    color: var(--orrery-pick-ink);
    font-weight: 600;

    &:hover {
        background-color: var(--orrery-pick);
        filter: brightness(1.1);
    }

    &:disabled {
        border-color: var(--orrery-pick);
        background: none;
        color: var(--orrery-pick);
        cursor: default;
        filter: none;
    }
}

@media (forced-colors: active) {
    .orrery__search-picked {
        background-color: CanvasText;
    }

    .orrery__search-button--pick {
        border-color: ButtonText;

        &:disabled {
            border-color: GrayText;
        }
    }
}
</style>
