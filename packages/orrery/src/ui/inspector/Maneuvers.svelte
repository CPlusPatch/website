<script lang="ts">
import { PRESETS } from "@cpluspatch/catalog";
import { dateText } from "@cpluspatch/render";
import { iconSvg } from "@cpluspatch/ui";
import { tick } from "svelte";
import { getAnnouncer, getDocument, getView } from "../../state/context.ts";
import Warning from "../Warning.svelte";
import {
    firstUpcoming,
    maneuverRows,
    rejectedRemove,
    removedMessage,
    removeLabel,
} from "./maneuvers.ts";

type Props = {
    /** The body whose events the section lists. */
    id: string;
    /** The clock in seconds since J2000, as of the card's last refresh. */
    now: number;
    /** Called after the last event is removed, as the section is gone then. */
    onEmptied: () => void;
};

const { id, now, onEmptied }: Props = $props();

const documents = getDocument();
const view = getView();
const announce = getAnnouncer();

let list = $state<HTMLElement>();
let error = $state("");

const rows = $derived(maneuverRows(documents.doc.timeline, id, now));
const clockIndex = $derived(firstUpcoming(rows));

// An error is about the document it was raised against.
$effect(() => {
    void documents.doc;

    error = "";
});

const remove = async (index: number) => {
    const row = rows[index];
    if (!row) return;

    const result = documents.dispatch({ type: "remove-event", id: row.id });
    if (!result.ok) {
        error =
            rejectedRemove(documents.doc, row.id, PRESETS) ??
            result.errors.join(" ");
        // The warning sits under the list, often below the card's scrolled view.
        await tick();
        list?.parentElement
            ?.querySelector(".orrery__warning")
            ?.scrollIntoView({ block: "nearest" });

        return;
    }

    announce(removedMessage(row));

    // Only the removed row's button had focus, so it would drop to <body>.
    await tick();
    if (rows.length === 0) {
        onEmptied();

        return;
    }

    const buttons = list?.querySelectorAll<HTMLElement>(
        ".orrery__maneuver-remove",
    );
    // The rows after the removed one have shifted up to its index.
    (buttons?.[index] ?? buttons?.[index - 1])?.focus();
};
</script>

{#snippet clockRule()}
    <li class="orrery__maneuver-clock" aria-hidden="true">
        <span class="orrery__maneuver-bar"></span>
        <span class="orrery__maneuver-tag">Now {dateText(now)}</span>
    </li>
{/snippet}

{#if rows.length > 0}
    <section class="orrery__maneuvers">
        <h3>Maneuvers</h3>
        <ol class="orrery__maneuver-list" bind:this={list}>
            {#each rows as row, index (row.id)}
                {#if index === clockIndex}
                    {@render clockRule()}
                {/if}
                <li
                    class="orrery__maneuver"
                    data-past={row.past ? "" : undefined}
                >
                    <span class="orrery__maneuver-node">
                        <svg viewBox="0 0 12 12" aria-hidden="true">
                            {#if row.kind === "burn"}
                                <circle data-shape cx="6" cy="6" r="5" />
                            {:else}
                                <path data-shape d="M6 .5 11.5 6 6 11.5.5 6Z" />
                            {/if}
                        </svg>
                        <span class="visually-hidden">
                            {row.past ? "Past" : "Upcoming"}
                        </span>
                    </span>
                    <div>
                        <div class="orrery__maneuver-line">
                            <button
                                type="button"
                                class="orrery__maneuver-when"
                                aria-label="Jump clock to {row.when}"
                                onclick={() =>
                                    view.setClock({ t: row.t, paused: true })}
                            >
                                {row.when}
                            </button>
                            <button
                                type="button"
                                class="orrery__maneuver-remove"
                                aria-label={removeLabel(row)}
                                onclick={() => remove(index)}
                            >
                                {@html iconSvg("x")}
                            </button>
                        </div>
                        <div class="orrery__maneuver-detail">
                            <span class="orrery__maneuver-what">
                                {#if row.kind === "burn"}
                                    Burn
                                    <span class="orrery__maneuver-dv"
                                        >Δv {row.amount} {row.unit}</span
                                    >
                                {:else}
                                    {row.what}
                                {/if}
                            </span>
                            <span class="orrery__maneuver-ago">{row.ago}</span>
                        </div>
                    </div>
                </li>
            {/each}
            {#if clockIndex === rows.length}
                {@render clockRule()}
            {/if}
        </ol>
        <Warning text={error} hidden={error === ""} />
    </section>
{/if}

<style>
.orrery__maneuvers {
    --maneuver-node-col: 1.25rem;
    --maneuver-col-gap: 8px;
    --maneuver-line: 2px;
    --maneuver-box: 1.75rem;
    --maneuver-row: 1.75rem;
    --maneuver-row-gap: 12px;
    --maneuver-node: 0.75rem;
    margin-block-start: var(--orrery-pad);

    /* The scroll body has its own top padding. */
    &:first-child {
        margin-block-start: 0;
    }

    h3 {
        margin: 0 0 6px;
        color: var(--orrery-muted);
        font-size: var(--orrery-size-label);
        font-weight: 500;
    }

    /* A touch target on a phone. */
    @media (max-width: 720px) {
        --maneuver-row: 2.75rem;
    }
}

.orrery__maneuver-list {
    margin: 0;
    padding: 0;
    list-style: none;

    > li {
        --half: calc(var(--maneuver-row) / 2);

        position: relative;
        display: grid;
        grid-template-columns: var(--maneuver-node-col) minmax(0, 1fr);
        column-gap: var(--maneuver-col-gap);
        padding-block-end: var(--maneuver-row-gap);

        &:last-child {
            padding-block-end: 0;
        }

        /* The line through a row, from its top to the next row's top. */
        &::before {
            content: "";
            position: absolute;
            inset-inline-start: calc(
                (var(--maneuver-node-col) - var(--maneuver-line)) /
                2
            );
            inset-block: 0;
            inline-size: var(--maneuver-line);
            background: var(--orrery-dim);
        }

        &:first-child::before {
            inset-block-start: var(--half);
        }

        &:last-child::before {
            inset-block-end: auto;
            block-size: var(--half);
        }

        &:first-child:last-child::before {
            display: none;
        }
    }
}

/* Upcoming stretches are dashed. */
.orrery__maneuver:not([data-past])::before {
    background: repeating-linear-gradient(
        to bottom,
        var(--orrery-dim) 0 4px,
        transparent 4px 8px
    );
}

.orrery__maneuver-node {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    block-size: var(--maneuver-row);

    svg {
        inline-size: var(--maneuver-node);
        block-size: var(--maneuver-node);
        overflow: visible;
    }

    [data-shape] {
        fill: var(--orrery-panel-solid);
        stroke: var(--orrery-text);
        stroke-width: 2;
        stroke-linejoin: miter;
    }
}

[data-past] > .orrery__maneuver-node [data-shape] {
    fill: var(--orrery-muted);
    stroke: var(--orrery-muted);
}

.orrery__maneuver-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    min-block-size: var(--maneuver-row);
}

.orrery__maneuver-detail {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    column-gap: var(--space-sm);
    margin-block-start: 2px;
    /* Lines up with the time's digits, past the button's border and padding. */
    padding-inline-start: 7px;
    font-size: var(--orrery-size-sm);
}

.orrery__maneuver-what {
    font-family: var(--orrery-font-ui);

    [data-past] & {
        color: var(--orrery-muted);
    }
}

.orrery__maneuver-dv {
    font-family: var(--orrery-font-data);
    font-variant-numeric: tabular-nums;
}

.orrery__maneuver-ago {
    color: var(--orrery-muted);
    font-size: var(--orrery-size-label);
}

.orrery__maneuver-when {
    position: relative;
    min-block-size: var(--maneuver-box);
    padding: 0 6px;
    border: 1px solid var(--orrery-rule);
    background: transparent;
    color: var(--orrery-text);
    font: 500 var(--orrery-size-sm) var(--orrery-font-data);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    cursor: pointer;

    [data-past] & {
        color: var(--orrery-muted);
    }

    /* Reaches the row's height on a phone without drawing a taller box. */
    &::after {
        content: "";
        position: absolute;
        inset-block: calc((var(--maneuver-box) - var(--maneuver-row)) / 2);
        inset-inline: 0;
    }

    &:focus-visible {
        outline: 2px solid var(--orrery-text);
        outline-offset: 2px;
    }

    @media (hover: hover) {
        &:hover {
            border-color: var(--orrery-control-frame);
            background: var(--orrery-panel-raised);
        }
    }
}

.orrery__maneuver-remove {
    display: grid;
    place-items: center;
    inline-size: var(--maneuver-row);
    block-size: var(--maneuver-row);
    padding: 0;
    border: 0;
    background: none;
    color: var(--orrery-muted);
    font-size: 0.875rem;
    cursor: pointer;

    &:focus-visible {
        outline: 2px solid var(--orrery-text);
        outline-offset: 2px;
    }

    @media (hover: hover) {
        &:hover {
            background: var(--orrery-panel-raised);
            color: var(--orrery-abort);
        }
    }
}

/* Quiet until the row is hovered or focused. Touch has no hover, so it stays visible there. */
@media (hover: hover) and (pointer: fine) {
    .orrery__maneuver .orrery__maneuver-remove {
        opacity: 0;
    }

    .orrery__maneuver:is(:hover, :focus-within) .orrery__maneuver-remove {
        opacity: 1;
    }
}

/* The clock: the one light block on the rail, like the timeline's date tag. */
.orrery__maneuver-list > .orrery__maneuver-clock {
    --half: 0.75rem;

    align-items: center;

    &::before {
        inset-block-end: auto;
        block-size: var(--half);
    }

    &::after {
        content: "";
        position: absolute;
        inset-inline-start: calc(
            (var(--maneuver-node-col) - var(--maneuver-line)) /
            2
        );
        inset-block: var(--half) 0;
        inline-size: var(--maneuver-line);
        background: repeating-linear-gradient(
            to bottom,
            var(--orrery-dim) 0 4px,
            transparent 4px 8px
        );
    }

    &:first-child::before,
    &:last-child::after {
        display: none;
    }
}

.orrery__maneuver-bar {
    position: relative;
    z-index: 1;
    inline-size: calc(100% + var(--maneuver-col-gap));
    block-size: var(--maneuver-line);
    background: var(--orrery-text);
}

.orrery__maneuver-tag {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    block-size: 1.5rem;
    padding: 0 8px;
    background: var(--orrery-text);
    color: var(--orrery-tag-ink);
    font: 600 var(--orrery-size-label) var(--orrery-font-ui);
    letter-spacing: 0.02em;
    font-variant-numeric: tabular-nums;
}
</style>
