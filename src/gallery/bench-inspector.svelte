<script lang="ts">
import Icon from "@cpluspatch/ui/svelte/icon.svelte";
import Button from "@cpluspatch/ui/svelte/ui/button.svelte";
import TabList from "@cpluspatch/ui/svelte/ui/tab-list.svelte";
import TabPanel from "@cpluspatch/ui/svelte/ui/tab-panel.svelte";
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
import BenchProps from "./bench-props.svelte";
import BenchSettings from "./bench-settings.svelte";
import type { ControlValues } from "./controls.ts";
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
    /** The controls' values after a pick. */
    oncontrols: (values: ControlValues) => void;
    onstage: (backdrop: Backdrop) => void;
    onoutline: (outline: boolean) => void;
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
    oncontrols,
    onstage,
    onoutline,
}: Props = $props();

const TABS = [
    { value: "props", label: "Props" },
    { value: "look", label: "Look" },
];

// Not saved: it's back on Props after a reload.
let tab = $state("props");

const story = $derived(group.stories.find((s) => s.name === current.story));
const values = $derived(story ? valuesOf(story, current.query) : {});
const source = $derived(story && liveSource(story, values));
// The component's own tags are already shown above.
const storyTags = $derived(story?.tags.filter((t) => !tags.includes(t)) ?? []);
</script>

<div class="bench-inspector">
    <BenchAbout {title} {description} {sources} {site} {tags} {storyTags} />

    <div class="bench-inspector__tabs">
        <TabList
            id="bench-inspector"
            label="Inspector"
            items={TABS}
            bind:value={tab}
        />
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
                href={pickPath(current, story)}
                onchange={oncontrols}
            />
        </TabPanel>
        <TabPanel tabs="bench-inspector" value="look" selected={tab === "look"}>
            {#if mounted}
                <BenchSettings
                    stage={backdrop}
                    {outline}
                    {onstage}
                    {onoutline}
                />
            {/if}
        </TabPanel>
    </div>

    {#if story}
        <section class="bench-inspector__section">
            {#if source}
                <BenchCode {source} />
            {/if}
            <Button
                href={pickPath(current, story)}
                variant="outline"
                tone="secondary"
                size="sm"
            >
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
