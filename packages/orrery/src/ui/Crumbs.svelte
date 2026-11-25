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
