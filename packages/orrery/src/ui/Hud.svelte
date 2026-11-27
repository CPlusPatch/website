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

<style>
.orrery__hud-zoom,
.orrery__hud-extra {
    display: flex;
}

/* The buttons share a row, with the scale under them. The sound menu comes from the page. */
.orrery__hud-zoom {
    grid-area: 1 / 1;
}

.orrery__hud-extra {
    grid-area: 1 / 2;
}

.orrery__hud-scale {
    grid-area: 2 / 1 / 3 / -1;
}

.orrery__hud-button {
    display: grid;
    place-items: center;
    inline-size: var(--orrery-control);
    block-size: var(--orrery-control);
    padding: 0;
    color: var(--orrery-text);
    cursor: pointer;

    & + & {
        border-inline-start: 1px solid var(--orrery-rule);
    }

    @media (hover: hover) {
        &:hover:not(:disabled) {
            background-color: var(--orrery-panel-raised);
        }
    }

    &[aria-pressed="true"] {
        background-color: var(--orrery-go);
        color: var(--orrery-go-ink);

        /* The plain hover outranks this, and its grey hid the dark ink. */
        @media (hover: hover) {
            &:hover:not(:disabled) {
                background-color: var(--color-success-hover);
            }
        }
    }

    /* Struck through, so disabled differs in shape, not only in colour. */
    &:disabled {
        background-image: linear-gradient(
            to top right,
            transparent calc(50% - 0.75px),
            var(--orrery-dim) calc(50% - 0.75px) calc(50% + 0.75px),
            transparent calc(50% + 0.75px)
        );
        background-size: 60% 60%;
        background-position: center;
        background-repeat: no-repeat;
        color: var(--orrery-dim);
        cursor: default;
    }

    &:focus-visible {
        outline-offset: 2px;
    }

    :global(svg) {
        inline-size: 16px;
        block-size: 16px;
    }
}

/* The bar stacks over its label above 720px, and sits beside it below. */
.orrery__hud-scale {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    color: var(--orrery-muted);
    font: 400 var(--orrery-size-xs) / 1.2 var(--orrery-font-data);
    white-space: nowrap;
    /* Markers and orbit lines pass behind it, so it needs its own ground. */
    background-color: var(--orrery-ground);
    box-shadow: 0 0 0 var(--space-xs) var(--orrery-ground);
    pointer-events: none;
}

/* No top edge, so it reads as a ruler's end stops. */
.orrery__hud-bar {
    block-size: 6px;
    border: 1px solid var(--orrery-muted);
    border-block-start: 0;
}

@media (max-width: 720px) {
    .orrery__hud-zoom {
        grid-area: 3 / 1;
    }

    .orrery__hud-extra {
        grid-area: 1 / 3;
    }

    .orrery__hud-scale {
        grid-area: 3 / 2;
        /* Its ground stays as wide as the bar and label, not the column. */
        justify-self: start;
        align-self: center;
        flex-direction: row;
        align-items: center;
        gap: var(--space-sm);
    }

    .orrery__hud-button {
        inline-size: var(--control-height-md);
        block-size: var(--control-height-md);
    }
}

@media (forced-colors: active) {
    .orrery__hud-zoom,
    .orrery__hud-extra {
        border-color: ButtonText;
    }

    .orrery__hud-button + .orrery__hud-button {
        border-color: ButtonText;
    }

    .orrery__hud-button[aria-pressed="true"] {
        background-color: Highlight;
        color: HighlightText;
    }

    .orrery__hud-bar {
        border-color: CanvasText;
    }

    .orrery__hud-scale {
        color: CanvasText;
    }
}
</style>
