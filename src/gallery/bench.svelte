<script lang="ts">
import { onMount, type Snippet } from "svelte";
import {
    type BenchGroup,
    firstPick,
    type Pick,
    parseHash,
    pickHash,
    pickId,
    pickPath,
} from "./bench.ts";
import BenchBar from "./bench-bar.svelte";
import BenchInspector from "./bench-inspector.svelte";
import BenchList from "./bench-list.svelte";
import BenchStage from "./bench-stage.svelte";
import type { Tag } from "./story.ts";

/**
 * A component's stories as a workbench: the story list, a stage (one page of
 * stories in a frame) and an inspector. Without JS the list's links load
 * into the frame. With it, the pick is the URL hash (`#<group>/<story>`, or
 * `#<group>` for all of a group's stories), and each pick is one history
 * entry. This owns the page-wide wiring (hash, history, Display menu); the
 * parts only take props.
 */
type Props = {
    /** The component's title, for the bar. */
    title: string;
    /** Where the component sits in its category, for the bar. */
    position: string;
    previous?: { href: string; title: string };
    next?: { href: string; title: string };
    /** The bar's menus, which come from the page as an Astro slot. */
    actions?: Snippet;
    description?: string;
    sources: string[];
    /** Whether the component lives in this site, not the library. */
    site: boolean;
    tags: Tag[];
    groups: BenchGroup[];
};

const {
    title,
    position,
    previous,
    next,
    actions,
    description,
    sources,
    site,
    tags,
    groups,
}: Props = $props();

// Island props never change, so the first pick is read once.
// svelte-ignore state_referenced_locally
const first = firstPick(groups);

let current = $state<Pick>(first);
let stage: BenchStage | undefined = $state();

const group = $derived(
    groups.find((g) => g.id === current.group) ?? (groups[0] as BenchGroup),
);
const id = $derived(pickId(current));

const fromHash = () => parseHash(groups, location.hash) ?? first;

onMount(() => {
    current = fromHash();

    const onHashChange = () => {
        current = fromHash();
    };
    // A Display choice was just saved: reload the stage to pick it up.
    const onDisplayChange = (event: Event) => {
        if (!(event.target as Element).closest(".display-menu")) return;
        requestAnimationFrame(() => stage?.reload());
    };
    window.addEventListener("hashchange", onHashChange);
    document.addEventListener("change", onDisplayChange);

    return () => {
        window.removeEventListener("hashchange", onHashChange);
        document.removeEventListener("change", onDisplayChange);
    };
});
</script>

<div class="bench">
    <div class="bench__panel">
        <BenchBar {title} current={id} {position} {previous} {next} {actions} />
        <div class="bench__columns">
            <nav class="bench__list" aria-label="Stories">
                <BenchList
                    {groups}
                    current={id}
                    label={id}
                    onpick={(pick) => {
                        location.hash = pickHash(pick);
                    }}
                />
            </nav>
            <div class="bench__stage" id="stage">
                <BenchStage
                    bind:this={stage}
                    url={pickPath(current)}
                    title={id}
                    onhashlink={(hash) => {
                        if (!parseHash(groups, hash)) return false;
                        location.hash = hash;
                        return true;
                    }}
                />
            </div>
            <aside class="bench__inspector" aria-label="Inspector">
                <BenchInspector
                    {description}
                    {sources}
                    {site}
                    {tags}
                    {group}
                    {current}
                />
            </aside>
        </div>
    </div>
</div>

<style>
.bench {
    container: bench / inline-size;
    min-width: 0;
}

/* The viewport: the bar, then the columns, each scrolling on its own. */
.bench__panel {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    height: 100dvh;
    background-color: var(--color-bg);
}

.bench__columns {
    display: grid;
    grid-template-columns:
        minmax(12rem, 16rem)
        minmax(0, 1fr)
        minmax(14rem, 20rem);
    min-height: 0;
}

.bench__list,
.bench__stage,
.bench__inspector {
    min-height: 0;
    overflow-y: auto;
}

.bench__stage {
    min-width: 0;
    border-inline: var(--border-width) solid var(--border-color);
}

.bench__list {
    padding: var(--space-sm);
}

.bench__inspector {
    padding: var(--space-md);
}

/* Narrow: the page scrolls, with the list, the stage, then the inspector. */
@container bench (width < 52rem) {
    .bench__panel {
        display: block;
        height: auto;
    }

    .bench__columns {
        display: block;
    }

    .bench__stage {
        /* A frame this tall at least, as the column has no height to fill. */
        --bench-stage-min: 24rem;

        border-inline: 0;
        border-block: var(--border-width) solid var(--border-color);
    }

    .bench__list,
    .bench__stage,
    .bench__inspector {
        overflow-y: visible;
    }
}
</style>
