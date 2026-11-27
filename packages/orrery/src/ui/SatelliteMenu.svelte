<script lang="ts">
import { GROUP_CLASSES } from "@cpluspatch/catalog";
import {
    type OrbitClass,
    SATELLITE_GROUPS,
    type SatelliteGroup,
} from "@cpluspatch/sim";
import { iconSvg } from "@cpluspatch/ui";
import { onMount, untrack } from "svelte";
import type { SavedStorage } from "../persistence.ts";
import { readSatellites, writeSatellites } from "../satellite-settings.ts";
import { roleMarker } from "./body-marker.ts";
import Menu from "./Menu.svelte";
import {
    ALL,
    CLASSES,
    fmt,
    footLines,
    itemLabel,
    LABELS,
    outsideNote,
    present,
    type ShownCounts,
    shownCounts,
    total,
} from "./satellite-groups.ts";

/** What the menu needs from the scene's clock. */
export type SatelliteClock = {
    /** The clock's time in seconds since J2000. */
    now: () => number;
    goLive: () => void;
};

type Props = {
    storage: SavedStorage;
    /** Called with the groups that are on, in the order of `SATELLITE_GROUPS`. */
    onChange: (groups: SatelliteGroup[]) => void;
    clock: SatelliteClock;
};

/** How often the "Shown" row checks the clock while the menu is open, in ms. */
const REFRESH_MS = 500;

const { storage, onChange, clock }: Props = $props();

const rows = SATELLITE_GROUPS.map((group) => {
    const counts = GROUP_CLASSES[group];
    const classes = present(counts);

    return {
        group,
        counts,
        classes,
        // A single orbit class sits on the row's first line.
        only: classes.length === 1 ? classes[0] : undefined,
    };
});
const foot = footLines();

let wrapper: HTMLElement | undefined;
let menu = $state.raw<ReturnType<typeof Menu>>();

// The storage doesn't change for the life of the component, so the first read is enough.
let active = $state.raw(new Set(untrack(() => readSatellites(storage))));
let available = $state(true);

// The last counts from inside the snapshot's window, which stay while the clock is outside it.
let row = $state.raw<ShownCounts | null>(null);
let outside = $state.raw(false);
let note = $state.raw("");
const figure = $derived(outside ? "0" : fmt(row?.shown ?? 0));

const render = () => {
    const text = outsideNote(clock.now());
    outside = text !== null;
    if (text === null) row = shownCounts(active);
    else note = text;
};
untrack(render);

// In the order of `SATELLITE_GROUPS`, whatever order they were switched on in.
const list = (): SatelliteGroup[] =>
    SATELLITE_GROUPS.filter((group) => active.has(group));

const toggle = (group: SatelliteGroup) => {
    const next = new Set(active);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    active = next;
    render();

    const groups = list();
    writeSatellites(storage, groups);
    onChange(groups);
};

const goNow = () => {
    clock.goLive();
    render();
};

// The clock moves while the menu is open, so the "Shown" row polls it.
let refresh: ReturnType<typeof setInterval> | undefined;
const stopRefresh = () => {
    clearInterval(refresh);
    refresh = undefined;
};

const onToggle = (open: boolean) => {
    stopRefresh();
    if (!open) return;

    render();
    refresh = setInterval(render, REFRESH_MS);
};

onMount(() => stopRefresh);

/** The wrapper of the button and its menu. */
export const element = (): HTMLElement | undefined => wrapper;

/** The groups that are on. */
export const groups = list;

/** Shows or hides the button. Hiding it closes the menu, and the groups stay on. */
export const setAvailable = (on: boolean): void => {
    available = on;
    if (!on) menu?.close(false);
};
</script>

{#snippet seg(
    orbit: OrbitClass | "rest",
    count: number,
)}
    <!-- biome-ignore format: Whitespace between the elements would be rendered. -->
    <span class="orrery__satellite-seg orrery__satellite-seg--{orbit}" style:--n={count} data-zero={count === 0 ? "" : undefined}></span>
{/snippet}

{#snippet cell(
    orbit: OrbitClass,
    count?: string,
    zero?: boolean,
)}
    <!-- biome-ignore format: Same. -->
    <span class="orrery__satellite-cell" data-zero={zero ? "" : undefined}><i class="orrery__satellite-swatch orrery__satellite-seg--{orbit}"></i><span>{orbit.toUpperCase()}</span>{#if count !== undefined}<span class="orrery__satellite-count">{count}</span>{/if}</span>
{/snippet}

<!-- biome-ignore format: Same. -->
<div class="orrery__satellites" hidden={!available} bind:this={wrapper}><Menu
    bind:this={menu}
    id="orrery-satellite-menu"
    label="Satellites"
    buttonClass="orrery__tool"
    popupClass="orrery__satellite-menu"
    describedby="orrery-satellite-foot"
    {onToggle}
>
    {#snippet button()}
        <!-- biome-ignore format: Same. -->
        <span class="orrery__tool-icon">{@html roleMarker("other")}</span><span class="orrery__tool-label">Satellites</span>
    {/snippet}
    {#snippet items()}
        {#each rows as { group, counts, classes, only } (group)}
            <!-- biome-ignore format: Same. -->
            <button type="button" class="orrery__satellite-item" role="menuitemcheckbox" aria-checked={active.has(group)} aria-label={itemLabel(group)} tabindex="-1" onclick={() => toggle(group)}><span class="orrery__satellite-margin"><span class="orrery__satellite-mark">{@html iconSvg("check")}</span></span><span class="orrery__satellite-label">{LABELS[group]}</span>{#if only}<span class="orrery__satellite-tag" aria-hidden="true">{@render cell(only)}</span>{/if}<span class="orrery__satellite-total">{fmt(total(group))}</span>{#if classes.length > 1}<span class="orrery__satellite-bar" aria-hidden="true">{#each classes as orbit (orbit)}{@render seg(orbit, counts[orbit])}{/each}</span><span class="orrery__satellite-detail" aria-hidden="true">{#each classes as orbit (orbit)}{@render cell(orbit, fmt(counts[orbit]))}{/each}</span>{/if}</button>
        {/each}
    {/snippet}
    <!-- The figure is before "of", so a screen reader says "Shown 14,338 of 16,897". -->
    <!-- biome-ignore format: Same. -->
    {#snippet extras()}
        <div class="orrery__satellite-total-row" role="status" data-outside={outside ? "" : undefined}><div class="orrery__satellite-total-head"><span class="orrery__satellite-total-name">Shown</span><span class="orrery__satellite-figure">{figure}</span><span class="orrery__satellite-of">of {fmt(ALL)}</span></div><div class="orrery__satellite-bar orrery__satellite-bar--total" aria-hidden="true">{#each CLASSES as orbit (orbit)}{@render seg(orbit, row?.counts[orbit] ?? 0)}{/each}{@render seg("rest", row?.rest ?? 0)}</div><div class="orrery__satellite-detail" aria-hidden="true">{#each CLASSES as orbit (orbit)}{@render cell(
    orbit,
    row ? fmt(row.counts[orbit]) : "",
    row !== null && row.counts[orbit] === 0,
)}{/each}</div><div class="orrery__satellite-outside"><span>{note}</span><button type="button" class="orrery__satellite-go-now" title="Real time (L)" aria-keyshortcuts="L" onclick={goNow}>Go to now</button></div></div
        ><div id="orrery-satellite-foot">{#each foot as line (line)}<p class="orrery__satellite-foot">{line}</p>{/each}</div>
    {/snippet}
</Menu></div>

<style>
/* The top bar frames this box like its other buttons, so the menu hangs off it. */
.orrery__satellites {
    position: relative;
    display: flex;
    align-self: stretch;

    &[hidden] {
        display: none;
    }

    /* The ring goes round the box, so its gap to the frame matches the other buttons. */
    &:has(> :global(.orrery__tool):focus-visible) {
        outline: 2px solid var(--orrery-text);
        outline-offset: 2px;
    }

    > :global(.orrery__tool):focus-visible {
        outline: none;
    }

    /* Inside the frame, so the box is as tall as the other tools. */
    > :global(.orrery__tool) {
        min-block-size: calc(var(--orrery-control) - 2px);
    }

    > :global(.orrery__tool[aria-expanded="true"]) {
        background-color: var(--orrery-panel-raised);
        color: var(--orrery-text);
    }
}

:global(.orrery__satellite-menu) {
    --satellite-margin: 2.25rem;

    position: absolute;
    z-index: 4;
    /* Over the frame, so the menu lines up with the button's outer edge. */
    inset-inline-end: -1px;
    inset-block-start: calc(100% + 1px + var(--space-sm));
    /* At 320px the button ends 60px from the right, so 240px keeps a left gutter. */
    inline-size: 240px;
    /* The room below the top bar, less the drop and a margin at the bottom. */
    max-block-size: calc(
        100dvh -
        var(--orrery-top-space) -
        var(--space-sm) -
        var(--orrery-inset) -
        2px
    );
    overflow-y: auto;
    border: 1px solid var(--orrery-frame);
    background-color: var(--orrery-panel-solid);

    &[hidden] {
        display: none;
    }

    @media (min-width: 720px) {
        inline-size: 304px;
    }
}

.orrery__satellite-item {
    display: grid;
    grid-template-columns: var(--satellite-margin) minmax(0, 1fr) auto auto;
    align-items: baseline;
    inline-size: 100%;
    /* Touch size below 720px. */
    min-block-size: 2.75rem;
    padding: 0.5rem var(--orrery-pad) 0.5rem 0;
    border-block-end: 1px solid var(--orrery-rule);
    color: var(--orrery-muted);
    font: 500 var(--orrery-size-md) / 1.35 var(--orrery-font-ui);
    text-align: start;
    cursor: pointer;
    user-select: none;

    @media (min-width: 720px) {
        min-block-size: 1.875rem;
    }

    /* The Shown row's top border closes the list. */
    &:last-child {
        border-block-end: 0;
    }

    &:hover {
        background-color: var(--orrery-panel-raised);
    }

    &:focus-visible {
        outline-offset: -2px;
    }

    &[aria-checked="true"] {
        color: var(--orrery-text);
    }
}

/* The ledger's margin line, full row height beside the check marks. */
.orrery__satellite-margin {
    grid-row: 1 / span 3;
    grid-column: 1;
    align-self: stretch;
    display: flex;
    justify-content: center;
    margin-block: -0.5rem;
    padding-block-start: 0.6875rem;
    border-inline-end: 1px solid var(--orrery-rule);
}

.orrery__satellite-mark {
    display: grid;
    place-items: center;
    flex: none;
    inline-size: 14px;
    block-size: 14px;
    border: 1px solid var(--orrery-muted);
    color: transparent;

    :global(svg) {
        inline-size: 10px;
        block-size: 10px;
    }

    [aria-checked="true"] > .orrery__satellite-margin > & {
        border-color: var(--orrery-go);
        background-color: var(--orrery-go);
        color: var(--orrery-go-ink);
    }
}

.orrery__satellite-label {
    grid-row: 1;
    grid-column: 2;
    padding-inline-start: 0.625rem;

    [aria-checked="true"] > & {
        font-weight: 600;
    }
}

/* The class of a single-class row, between the label and the total. */
.orrery__satellite-tag {
    grid-row: 1;
    grid-column: 3;
    padding-inline-end: 0.75rem;
    color: var(--orrery-muted);
    font: 400 var(--orrery-size-xs) / 1.35 var(--orrery-font-data);
}

.orrery__satellite-total {
    grid-row: 1;
    grid-column: 4;
    font: 400 var(--orrery-size-sm) / 1.35 var(--orrery-font-data);
    font-variant-numeric: tabular-nums;
    text-align: end;

    [aria-checked="true"] > & {
        font-weight: 600;
    }
}

.orrery__satellite-bar {
    grid-column: 2 / -1;
    margin: 0.375rem 0 0.375rem 0.625rem;
    display: flex;
    gap: 1px;
    block-size: 8px;
    overflow: hidden;

    /* A row that's off keeps only its legend. */
    .orrery__satellite-item[aria-checked="false"] > & {
        display: none;
    }

    &.orrery__satellite-bar--total {
        grid-column: auto;
        margin: 0;
        block-size: 12px;
    }
}

/* An orbit class is a segment sized by its count. Hollow means off. */
.orrery__satellite-seg {
    --seg-colour: var(--orrery-muted);

    flex: var(--n) 1 0;
    min-inline-size: min(4px, calc(var(--n) * 1000px));
    background-color: transparent;
    box-shadow: inset 0 0 0 1px var(--seg-colour);
    transition:
        flex-grow 0.25s ease-out,
        background-color 0.25s ease-out;

    &[data-zero] {
        display: none;
    }
}

.orrery__satellite-seg--leo {
    --seg-colour: var(--orrery-orbit-leo);
}

.orrery__satellite-seg--meo {
    --seg-colour: var(--orrery-orbit-meo);
}

.orrery__satellite-seg--geo {
    --seg-colour: var(--orrery-orbit-geo);
}

.orrery__satellite-seg--heo {
    --seg-colour: var(--orrery-orbit-heo);
}

.orrery__satellite-seg--rest {
    --seg-colour: var(--orrery-frame);
}

.orrery__satellite-swatch {
    flex: none;
    inline-size: 6px;
    block-size: 6px;
    align-self: center;
    box-shadow: inset 0 0 0 1px var(--seg-colour, var(--orrery-muted));
}

[aria-checked="true"] .orrery__satellite-seg:not(.orrery__satellite-seg--rest),
.orrery__satellite-total-row
    .orrery__satellite-seg:not(.orrery__satellite-seg--rest),
[aria-checked="true"] .orrery__satellite-swatch,
.orrery__satellite-total-row .orrery__satellite-swatch {
    background-color: var(--seg-colour);
}

/* Per-class counts, as wide as they need and wrapping when the menu is narrow. */
.orrery__satellite-detail {
    grid-column: 2 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.375rem;
    margin-inline-start: 0.625rem;
    color: var(--orrery-muted);
    font: 400 var(--orrery-size-xs) / 1.45 var(--orrery-font-data);
    font-variant-numeric: tabular-nums;
}

.orrery__satellite-cell {
    display: flex;
    align-items: baseline;
    gap: 0.1875rem;

    &[data-zero] {
        display: none;
    }
}

.orrery__satellite-total-row {
    padding: 0.5rem var(--orrery-pad) 0.625rem;
    border-block-start: 1px solid var(--orrery-frame);

    .orrery__satellite-detail {
        margin: 0.375rem 0 0;
        min-block-size: 1.45em;
    }
}

/* The note stands in for the bar and legend while nothing is drawn. */
.orrery__satellite-outside {
    display: none;
    margin-block-start: 0.375rem;
    color: var(--orrery-muted);
    font: 400 var(--orrery-size-xs) / 1.45 var(--orrery-font-ui);

    .orrery__satellite-total-row[data-outside] & {
        display: block;
    }
}

.orrery__satellite-go-now {
    display: block;
    margin-block-start: 0.25rem;
    padding: 0;
    border: 0;
    background: none;
    color: var(--orrery-text);
    font: inherit;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;

    &:hover {
        text-decoration-thickness: 2px;
    }
}

.orrery__satellite-total-row[data-outside] {
    .orrery__satellite-bar,
    .orrery__satellite-detail {
        display: none;
    }
}

.orrery__satellite-total-head {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin-block-end: 0.375rem;
}

.orrery__satellite-total-name {
    font-weight: 600;
}

.orrery__satellite-of {
    margin-inline-end: auto;
    color: var(--orrery-muted);
    font: 400 var(--orrery-size-xs) var(--orrery-font-data);
}

.orrery__satellite-figure {
    order: 1;
    font: 600 var(--orrery-size-md) / 1.2 var(--orrery-font-data);
    font-variant-numeric: tabular-nums;
}

.orrery__satellite-foot {
    margin: 0;
    padding: 0.5rem var(--orrery-pad);
    border-block-start: 1px solid var(--orrery-rule);
    color: var(--orrery-muted);
    font: 400 var(--orrery-size-xs) / 1.4 var(--orrery-font-ui);
    overflow-wrap: anywhere;
    text-wrap: balance;

    /* biome-ignore lint/style/noDescendingSpecificity: the rule it's flagged against styles .orrery__satellite-bar, not this */
    & + & {
        margin-block-start: -0.125rem;
        padding-block-start: 0;
        border-block-start: 0;
    }
}

@media (prefers-reduced-motion: reduce) {
    .orrery__satellite-seg {
        transition: none;
    }
}
</style>
