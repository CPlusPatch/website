<script lang="ts">
import Icon from "@cpluspatch/ui/svelte/icon.svelte";
import Button from "@cpluspatch/ui/svelte/ui/button.svelte";
import TabList from "@cpluspatch/ui/svelte/ui/tab-list.svelte";
import TabPanel from "@cpluspatch/ui/svelte/ui/tab-panel.svelte";
import { tick } from "svelte";
import {
    type Backdrop,
    type BenchGroup,
    liveSource,
    type Pick,
    pickPath,
    valuesOf,
} from "./bench.ts";
import BenchAbout from "./bench-about.svelte";
import BenchCode from "./bench-code.svelte";
import BenchLook from "./bench-look.svelte";
import BenchProps from "./bench-props.svelte";
import BenchSettings from "./bench-settings.svelte";
import type { CompareMode } from "./compare.ts";
import type { ControlValues } from "./controls.ts";
import { DEFAULT_LOOK, isDefaultLook, type Look, lookParams } from "./look.ts";
import { frameUrl, splitUrl } from "./play-frame.ts";
import type { Tag } from "./story.ts";

/** The bench's inspector: the component, then tabs for what's on the stage, and its code. */
type Props = {
    /** The component's title. */
    title: string;
    description?: string;
    sources: string[];
    /** Whether the component lives in this site, not the library. */
    site: boolean;
    tags: Tag[];
    group: BenchGroup;
    current: Pick;
    /** Whether JS has run, which the controls and settings need. */
    mounted: boolean;
    backdrop: Backdrop;
    outline: boolean;
    look: Look;
    /** The compare strip's mode, which sets the look's Mode while it compares schemes. */
    compare: CompareMode;
    /** The controls' values after a pick. */
    oncontrols: (values: ControlValues) => void;
    onstage: (backdrop: Backdrop) => void;
    onoutline: (outline: boolean) => void;
    onlook: (look: Look) => void;
};

const {
    title,
    description,
    sources,
    site,
    tags,
    group,
    current,
    mounted,
    backdrop,
    outline,
    look,
    compare,
    oncontrols,
    onstage,
    onoutline,
    onlook,
}: Props = $props();

const tabs = $derived([
    { value: "props", label: "Props" },
    { value: "look", label: "Look", changed: !isDefaultLook(look) },
]);

// Radio names are per instance, as a story page holds several inspectors.
const uid = $props.id();

// Not saved: it's back on Props after a reload.
let tab = $state("props");
let lookPanel: HTMLElement | undefined = $state();

const resetLook = async () => {
    onlook({ ...DEFAULT_LOOK });
    await tick();
    // The button goes with the change, so focus the Theme choice.
    lookPanel
        ?.querySelector<HTMLInputElement>("input[name$='-theme']:checked")
        ?.focus();
};

const story = $derived(group.stories.find((s) => s.name === current.story));
const values = $derived(story ? valuesOf(story, current.query) : {});
const source = $derived(story && liveSource(story, values));
// The page opened alone has the look too, as the stage has.
const alone = $derived.by(() => {
    const { path, query } = splitUrl(pickPath(current, story));

    return frameUrl(path, lookParams(look, compare), query);
});
// The component's own tags are already shown above.
const storyTags = $derived(story?.tags.filter((t) => !tags.includes(t)) ?? []);
</script>

<div class="bench-inspector">
    <BenchAbout {title} {description} {sources} {site} {tags} {storyTags} />

    <div class="bench-inspector__tabs">
        <TabList
            id="bench-inspector"
            label="Inspector"
            items={tabs}
            bind:value={tab}
        >
            {#if tab === "look" && !isDefaultLook(look)}
                <Button
                    type="button"
                    variant="ghost"
                    tone="secondary"
                    size="sm"
                    class="bench-inspector__reset"
                    onclick={resetLook}
                >
                    Reset look
                </Button>
            {/if}
        </TabList>
        <TabPanel
            tabs="bench-inspector"
            value="props"
            selected={tab === "props"}
        >
            <BenchProps
                {group}
                {story}
                {values}
                {mounted}
                href={alone}
                onchange={oncontrols}
            />
        </TabPanel>
        <TabPanel tabs="bench-inspector" value="look" selected={tab === "look"}>
            {#if mounted}
                <div class="bench-inspector__look" bind:this={lookPanel}>
                    <BenchLook
                        name={`bench-look-${uid}`}
                        {look}
                        {compare}
                        onchange={onlook}
                    />
                    <div class="bench-inspector__stage">
                        <BenchSettings
                            name={`bench-${uid}`}
                            stage={backdrop}
                            {outline}
                            {onstage}
                            {onoutline}
                        />
                    </div>
                </div>
            {/if}
        </TabPanel>
    </div>

    {#if story}
        <section class="bench-inspector__section">
            {#if source}
                <BenchCode {source} />
            {/if}
            <Button href={alone} variant="outline" tone="secondary" size="sm">
                Open alone
                <Icon name="lucide:maximize" aria-hidden="true" />
            </Button>
        </section>
    {/if}
</div>

<style>
.bench-inspector {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    min-width: 0;
    font-size: var(--font-size-sm);
}

.bench-inspector__tabs {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    min-width: 0;
}

/* Pulls the label, not the button's padding, onto the column's end edge. */
.bench-inspector__tabs :global(.bench-inspector__reset) {
    margin-inline-end: calc((var(--space-sm) + var(--border-width)) * -1);
}

.bench-inspector__look {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    min-width: 0;
}

/* The stage's own settings, apart from the look's. */
.bench-inspector__stage {
    padding-top: var(--space-md);
    border-top: var(--border-width) solid var(--border-color);
}

.bench-inspector__section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-sm);
    min-width: 0;
    max-width: 100%;
    padding-top: var(--space-md);
    border-top: var(--border-width) solid var(--border-color);
}
</style>
