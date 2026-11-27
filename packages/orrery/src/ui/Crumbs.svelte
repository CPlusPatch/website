<script lang="ts">
import { getDocument, getView } from "../state/context.ts";
import { bodyMarker } from "./body-marker.ts";
import { focusPath } from "./crumbs.ts";

type Satellite = { name: string; onClick: () => void };
type Crumb = {
    id: string;
    name: string;
    /** The marker's SVG and colour, or none for the satellite's. */
    marker?: { svg: string; color: string };
    current: boolean;
    onClick: () => void;
};

const documents = getDocument();
const view = getView();

let nav: HTMLElement | undefined;
let satellite = $state.raw<Satellite | null>(null);

// The satellite's id can't be a body's, so a body crumb never takes its place.
const crumbs = $derived.by((): Crumb[] => {
    const path = focusPath(documents.doc.scenario.bodies, view.focus);
    const bodies = path.map((body, at) => ({
        id: body.id,
        name: body.name,
        marker: {
            svg: bodyMarker(body),
            color: documents.colorOf(body, path[at - 1]),
        },
        current: body.id === view.focus && !satellite,
        onClick: () => view.setFocus(body.id),
    }));

    return satellite
        ? [
              ...bodies,
              {
                  id: "sat",
                  name: satellite.name,
                  current: true,
                  onClick: satellite.onClick,
              },
          ]
        : bodies;
});

/** Ends the path with a followed satellite, or drops it with `null`. */
export const setSatellite = (crumb: Satellite | null): void => {
    satellite = crumb;
};

// Removing the focused button would drop focus to <body>.
let had: string | undefined;

$effect.pre(() => {
    void crumbs;

    const active = document.activeElement;
    had =
        active instanceof HTMLElement && nav?.contains(active)
            ? active.dataset.id
            : undefined;
});

$effect(() => {
    void crumbs;

    const id = had;
    had = undefined;
    if (id === undefined || !nav || nav.contains(document.activeElement)) {
        return;
    }

    const target =
        nav.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`) ??
        nav.querySelector<HTMLElement>("[aria-current]");
    target?.focus();
});
</script>

<!-- No space between the spans: the old DOM had no text nodes here. -->
<nav class="orrery__crumbs" aria-label="Focus" bind:this={nav}>
    <ol class="orrery__crumb-list">
        {#each crumbs as crumb (crumb.id)}
            <li>
                <button
                    type="button"
                    class="orrery__crumb"
                    data-id={crumb.id}
                    aria-current={crumb.current ? "location" : undefined}
                    onclick={crumb.onClick}
                >
                    <span
                        class="orrery__crumb-marker"
                        class:orrery__crumb-marker--satellite={!crumb.marker}
                        style:color={crumb.marker?.color}
                        >{@html crumb.marker?.svg ?? ""}</span
                    ><span class="orrery__crumb-label">{crumb.name}</span>
                </button>
            </li>
        {/each}
    </ol>
</nav>

<style>
.orrery__crumbs {
    min-inline-size: 0;
}

.orrery__crumb-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;

    li {
        display: flex;
        align-items: center;
        gap: 2px;
    }

    /* A mask, not a rotated border, so the glyph sits in the middle of its box. */
    li + li::before {
        content: "";
        inline-size: 6px;
        block-size: 10px;
        margin-inline: 4px;
        background-color: var(--orrery-dim);
        mask:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 6 10'%3E%3Cpath d='m1 1 4 4-4 4' fill='none' stroke='%23000' stroke-width='1.5'/%3E%3C/svg%3E")
            center / contain no-repeat;

        @media (forced-colors: active) {
            forced-color-adjust: none;
            background-color: CanvasText;
        }
    }
}

.orrery__crumb {
    display: flex;
    align-items: center;
    gap: 6px;
    /* As tall as the tools, which add their border outside the control height. */
    block-size: calc(var(--orrery-control) + 2px);
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: 0;
    background: none;
    color: var(--orrery-text);
    font: 500 var(--orrery-size-sm) / 1 var(--orrery-font-ui);
    letter-spacing: 0.04em;
    cursor: pointer;

    &:hover,
    &[aria-current] {
        border-color: var(--orrery-frame);
    }
}

.orrery__crumb-marker {
    display: flex;
    inline-size: 14px;
    block-size: 14px;

    :global(svg) {
        inline-size: 100%;
        block-size: 100%;
    }
}

@media (max-width: 720px) {
    /* Takes the room the tools leave, and shrinks before they wrap. */
    .orrery__crumbs {
        flex: 1 1 0;
        /* The first crumb keeps its label, even at 320px. */
        min-inline-size: min-content;
    }

    .orrery__crumb-list {
        flex-wrap: nowrap;
    }

    /* Past the first crumb only the marker shows. */
    .orrery__crumb-list li + li .orrery__crumb-label {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip-path: inset(50%);
    }
}
</style>
