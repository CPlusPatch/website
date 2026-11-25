<script lang="ts">
import {
    type OrbitClass,
    SATELLITE_GROUPS,
    type SatelliteGroup,
} from "@cpluspatch/sim";
import { iconSvg } from "@cpluspatch/ui";
import { onMount, untrack } from "svelte";
import { GROUP_CLASSES } from "../catalogue-snapshot.ts";
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
