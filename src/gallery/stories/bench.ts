import type { BenchGroup } from "../bench.ts";
import BenchBar from "../bench-bar.svelte";
import BenchInspector from "../bench-inspector.svelte";
import BenchList from "../bench-list.svelte";
import BenchStage from "../bench-stage.svelte";
import { type StoryGroup, storyPath, svelteStory } from "../story.ts";

const sizes: BenchGroup = {
    id: "button-size",
    title: "Size and state",
    tags: [],
    stories: [
        { name: "lg", tags: [], source: '<Button size="lg">Lg</Button>' },
        { name: "sm", tags: [], source: '<Button size="sm">Sm</Button>' },
        {
            name: "spinning",
            tags: ["animated"],
            source: "<Button loading>Saving</Button>",
        },
    ],
};

const groups: BenchGroup[] = [
    {
        id: "button-group",
        title: "Groups",
        tags: [],
        stories: [
            {
                name: "segmented",
                tags: [],
                source: "<ButtonGroup>…</ButtonGroup>",
            },
        ],
    },
    sizes,
];

const sources = ["packages/ui/src/astro/ui/button.astro"];

// Stories render on the server only, so a pick goes nowhere.
const ignore = () => undefined;

export const bench: StoryGroup[] = [
    {
        id: "bench-bar",
        title: "Bench bar",
        category: "gallery",
        source: "src/gallery/bench-bar.svelte",
        min: "full",
        stories: [
            svelteStory("default", BenchBar, {
                title: "Buttons",
                current: "button-size/sm",
                position: "Primitives · 2 of 16",
                previous: { href: "/gallery/badges/", title: "Badges" },
                next: { href: "/gallery/cards/", title: "Cards" },
            }),
            svelteStory("next-only", BenchBar, {
                title: "Badges",
                current: "badge-variant/solid",
                position: "Primitives · 1 of 16",
                next: { href: "/gallery/buttons/", title: "Buttons" },
            }),
            svelteStory("no-neighbours", BenchBar, {
                title: "Footer",
                current: "footer/default",
                position: "Layout · 1 of 1",
            }),
            svelteStory("long-names", BenchBar, {
                title: "Interactive messages",
                current:
                    "interactive-message/a-very-long-story-name-that-runs-past-the-bar",
                position: "Chat · 12 of 12",
                previous: {
                    href: "/gallery/message/",
                    title: "Messages with a very long name",
                },
            }),
        ],
    },
    {
        id: "bench-list",
        title: "Bench list",
        category: "gallery",
        source: "src/gallery/bench-list.svelte",
        stories: [
            svelteStory("one-group", BenchList, {
                groups: [sizes],
                current: "button-size/sm",
                label: "button-size/sm",
                onpick: ignore,
            }),
            svelteStory("several-groups", BenchList, {
                groups,
                current: "button-size",
                label: "button-size",
                onpick: ignore,
            }),
        ],
    },
    {
        id: "bench-stage",
        title: "Bench stage",
        category: "gallery",
        source: "src/gallery/bench-stage.svelte",
        min: "full",
        stories: [
            svelteStory("default", BenchStage, {
                url: storyPath("button-size", "sm"),
                title: "button-size/sm",
            }),
        ],
    },
    {
        id: "bench-inspector",
        title: "Bench inspector",
        category: "gallery",
        source: "src/gallery/bench-inspector.svelte",
        min: 20,
        stories: [
            svelteStory("story", BenchInspector, {
                description: "Buttons, and links that look like them.",
                sources,
                site: false,
                tags: [],
                group: sizes,
                current: { group: "button-size", story: "spinning" },
            }),
            svelteStory("all-stories", BenchInspector, {
                description: "Buttons, and links that look like them.",
                sources,
                site: false,
                tags: [],
                group: sizes,
                current: { group: "button-size", story: null },
            }),
            svelteStory("site-only", BenchInspector, {
                sources: ["src/components/blocks/terminal/terminal.astro"],
                site: true,
                tags: ["live"],
                group: sizes,
                current: { group: "button-size", story: "lg" },
            }),
        ],
    },
];
