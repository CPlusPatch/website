<script lang="ts">
import {
    type ChaseState,
    scaleBar,
    setText,
    type Units,
    type View,
} from "@cpluspatch/render";
import { onMount, untrack } from "svelte";

type Props = {
    view: View;
    units: Units;
    /** Picks the scale bar's target length. */
    narrow: MediaQueryList;
};

/** The scale bar's target length in px, which is shorter where the bar stacks over its label. */
const TARGET_PX = 70;
const TARGET_NARROW_PX = 110;

const svg = (paths: string): string =>
    `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor">${paths}</svg>`;

const PLUS_ICON = svg('<path d="M8 3v10M3 8h10" stroke-width="1.8"/>');
const MINUS_ICON = svg('<path d="M3 8h10" stroke-width="1.8"/>');
const FIT_ICON = svg(
    '<path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke-width="1.6"/>',
);
// A body with speed lines trailing it.
const CHASE_ICON = svg(
    '<circle cx="11" cy="8" r="3" fill="currentColor" stroke="none"/><path d="M3 5h3M1 8h5M3 11h3" stroke-width="2"/>',
);

const { view, units, narrow }: Props = $props();

// The view doesn't change for the life of the component, so the first read is enough.
let chase = $state.raw<ChaseState>(
    untrack(() => ({ chasing: view.chasing(), canChase: view.canChase() })),
);

let bar: HTMLElement | undefined;
let label: HTMLElement | undefined;

onMount(() => view.onChase((state) => (chase = state)));

onMount(() => {
    let width = -1;
    const update = () => {
        const perPx = view.kmPerPx();
        if (!(perPx > 0) || !bar || !label) return;

        const next = scaleBar(
            perPx,
            narrow.matches ? TARGET_NARROW_PX : TARGET_PX,
            units.get(),
        );
        // Only a change is written, so a steady view costs no style work.
        const rounded = Math.round(next.px);
        if (rounded !== width) {
            width = rounded;
            bar.style.inlineSize = `${rounded}px`;
        }
        setText(label, next.label);
    };

    let frame = 0;
    const tick = () => {
        update();
        frame = requestAnimationFrame(tick);
    };
    tick();

    return () => cancelAnimationFrame(frame);
});
</script>

<!-- biome-ignore format: Whitespace between the elements would be rendered. -->
<!-- biome-ignore lint/a11y/useSemanticElements: A fieldset would add a border and a legend. -->
<div class="orrery__hud-zoom" role="group" aria-label="Zoom"><button type="button" class="orrery__hud-button" aria-label="Zoom in" onclick={() => view.zoom(1)}>{@html PLUS_ICON}</button><button type="button" class="orrery__hud-button" aria-label="Zoom out" onclick={() => view.zoom(-1)}>{@html MINUS_ICON}</button></div>
<!-- biome-ignore format: Same. -->
<!-- biome-ignore lint/a11y/useSemanticElements: Same. -->
<div class="orrery__hud-extra" role="group" aria-label="View"><button type="button" class="orrery__hud-button" aria-label="Fit the focus" onclick={() => view.fitFocus()}>{@html FIT_ICON}</button><button type="button" class="orrery__hud-button" aria-label="Chase the focus" aria-keyshortcuts="C" aria-pressed={chase.chasing} disabled={!chase.canChase} onclick={() => view.chase(!view.chasing())}>{@html CHASE_ICON}</button></div>
<!-- biome-ignore format: Same. -->
<div class="orrery__hud-scale" aria-hidden="true"><span class="orrery__hud-bar" bind:this={bar}></span><span class="orrery__hud-label" bind:this={label}></span></div>
