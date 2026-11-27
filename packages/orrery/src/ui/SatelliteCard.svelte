<script lang="ts">
import { SNAPSHOT_DATE } from "@cpluspatch/catalog";
import {
    formatAngle,
    formatDistance,
    formatDuration,
    type View,
} from "@cpluspatch/render";
import type { SatelliteFacts } from "@cpluspatch/sim";
import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { cardClasses } from "@cpluspatch/ui/components/card.ts";
import { flushSync, onMount, untrack } from "svelte";
import { FOCUS_ICON } from "./buttons.ts";
import { LABELS } from "./satellite-groups.ts";

type Props = {
    satellite: View["satellite"];
    /** Runs before the card hides with focus in it. */
    restoreFocus: () => void;
};

/** How often the altitude refreshes while the card is shown, in ms. */
const REFRESH_MS = 250;

const CLASS_NAMES: Record<SatelliteFacts["orbitClass"], string> = {
    leo: "low Earth orbit",
    meo: "medium Earth orbit",
    geo: "geosynchronous orbit",
    heo: "highly elliptical orbit",
};

const km = (value: number): string => formatDistance(value * 1000, "km");

const { satellite, restoreFocus }: Props = $props();

let section: HTMLElement | undefined;
let focusButton = $state.raw<HTMLButtonElement>();

// The selected satellite, or `null` while the card is hidden.
let shown = $state.raw<number | null>(null);
let facts = $state.raw<SatelliteFacts | null>(null);
let focused = $state.raw<number | null>(null);
let altitude = $state.raw("");
// Stays after the card hides, as the old card's title did.
let name = $state.raw("");

const visible = $derived(shown !== null);
const pressed = $derived(shown !== null && focused === shown);
const meta = $derived(
    facts ? `${LABELS[facts.group]}, ${CLASS_NAMES[facts.orbitClass]}` : "",
);
const readouts = $derived(
    facts
        ? [
              ["Altitude", altitude],
              ["Perigee", km(facts.perigeeKm)],
              ["Apogee", km(facts.apogeeKm)],
              ["Period", formatDuration(facts.periodS)],
              ["Inclination", formatAngle(facts.inclination)],
          ]
        : [],
);

/** Takes the selection and the focus from the view. Returns whether a satellite is selected. */
const read = (): boolean => {
    const k = satellite.selected();
    const next = k === null ? null : satellite.facts(k);
    focused = satellite.focused();
    if (k === null || !next) {
        shown = null;
        facts = null;

        return false;
    }

    shown = k;
    facts = next;
    name = next.name;
    altitude = km(next.altitudeKm);

    return true;
};

const render = () => {
    const hadFocus = section?.contains(document.activeElement) ?? false;
    // Hiding the focused close button would drop focus to <body>.
    if (!read() && hadFocus) restoreFocus();
    flushSync();

    // The card re-rendered under the focus, so the next thing to do with it gets it.
    if (hadFocus && !section?.contains(document.activeElement)) {
        focusButton?.focus();
    }
};

const refresh = () => {
    if (shown === null) return;

    const next = satellite.facts(shown);
    // The view clears the selection of a satellite that's gone.
    if (!next) return;

    altitude = km(next.altitudeKm);
};

untrack(read);

onMount(() =>
    satellite.on((event) => {
        if (event.type === "selection") render();
        else focused = satellite.focused();
    }),
);

$effect(() => {
    if (!visible) return;

    const timer = setInterval(refresh, REFRESH_MS);

    return () => clearInterval(timer);
});
</script>

<!-- biome-ignore format: Whitespace between the elements would be rendered. -->
<section class="{cardClasses().join(" ")} orrery__inspector orrery__satellite-card" aria-label="Selected satellite" hidden={!visible} bind:this={section}><div class="orrery__inspector-head"><span class="orrery__orbit-marker orrery__satellite-ring"></span><h2 class="orrery__orbit-title">{name}</h2><button type="button" class={buttonClasses({ variant: "ghost", tone: "neutral", size: "icon-sm" }).join(" ")} aria-label="Clear selection" onclick={() => satellite.select(null)}>{@html iconSvg("x")}</button></div
><div class="orrery__inspector-body">{#if facts}{#key shown}<p class="orrery__orbit-meta">{meta}</p><dl class="orrery__readouts">{#each readouts as [label, value] (label)}<dt>{label}</dt><dd class="orrery__readout">{value}</dd>{/each}</dl><p class="orrery__satellite-source">Orbits from CelesTrak, {SNAPSHOT_DATE}.</p><div class="orrery__orbit-actions"><div class="orrery__orbit-buttons"><button type="button" class="orrery__orbit-button orrery__orbit-focus" aria-pressed={pressed} bind:this={focusButton} onclick={() => shown !== null && satellite.focus(shown)}>{@html FOCUS_ICON}<span class="orrery__orbit-button-label">{pressed ? "Focused" : "Focus"}</span></button></div></div>{/key}{/if}</div></section>

<style>
.orrery__satellite-source {
    margin: var(--space-sm) 0 0;
    color: var(--orrery-muted);
    font: 400 var(--orrery-size-xs) / 1.4 var(--orrery-font-ui);
}

.orrery__orbit-title {
    flex: 1;
    min-inline-size: 0;
    margin: 0;
    overflow-wrap: anywhere;
    font: 600 var(--orrery-size-lg) / 1.75rem var(--orrery-font-ui);
    letter-spacing: 0.02em;
}

.orrery__orbit-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin-block-start: var(--space-md);
}

.orrery__orbit-buttons {
    display: flex;
    gap: var(--space-sm);
}

/* Sized by label, so Focused gets more room than Edit and Burn. */
.orrery__orbit-button {
    flex: auto;
    min-inline-size: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    block-size: var(--orrery-control-lg);
    padding: 0 0.75rem;
    border: 1px solid var(--orrery-control-frame);
    background-color: var(--orrery-panel-raised);
    color: var(--orrery-text);
    font: 500 var(--orrery-size-sm) var(--orrery-font-ui);
    letter-spacing: 0.02em;
    white-space: nowrap;
    cursor: pointer;

    @media (hover: hover) {
        &:hover {
            border-color: var(--orrery-text);
        }
    }

    &[aria-pressed="true"] {
        border-color: var(--orrery-go);
        background-color: var(--orrery-go);
        color: var(--orrery-go-ink);
    }

    /* From {@html}, so Svelte doesn't scope it. */
    :global(svg) {
        flex: none;
        inline-size: 15px;
        block-size: 15px;
    }

    /* A touch target on a phone. */
    @media (max-width: 720px) {
        min-block-size: var(--control-height-md);
    }
}
</style>
