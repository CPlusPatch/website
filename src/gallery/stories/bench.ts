import type { BenchGroup, BenchStory } from "../bench.ts";
import BenchBar from "../bench-bar.svelte";
import BenchCompare from "../bench-compare.svelte";
import BenchControls from "../bench-controls.svelte";
import BenchInspector from "../bench-inspector.svelte";
import BenchList from "../bench-list.svelte";
import BenchSettings from "../bench-settings.svelte";
import BenchStage from "../bench-stage.svelte";
import { type StoryGroup, storyPath, svelteStory } from "../story.ts";

const sizes: BenchGroup = {
    id: "button-size",
    title: "Size and state",
    tags: [],
    stories: [
        {
            name: "lg",
            tags: [],
            source: '<Button size="lg">Lg</Button>',
            component: "Button",
            controls: [],
        },
        {
            name: "sm",
            tags: [],
            source: '<Button size="sm">Sm</Button>',
            component: "Button",
            controls: [],
        },
        {
            name: "spinning",
            tags: ["animated"],
            source: "<Button loading>Saving</Button>",
            component: "Button",
            controls: [],
        },
    ],
};

const variant: BenchStory = {
    name: "default",
    tags: [],
    source: '<Button variant="solid" tone="primary">Button</Button>',
    component: "Button",
    controls: [
        {
            key: "variant",
            kind: "choice",
            values: ["solid", "outline", "ghost", "link"],
            value: "solid",
        },
        {
            key: "tone",
            kind: "choice",
            values: ["primary", "secondary", "destructive"],
            value: "primary",
        },
    ],
    play: "/gallery/play/button-variant/default/",
    live: { props: { variant: "solid", tone: "primary" }, slot: "Button" },
};

const controlled: BenchGroup = {
    id: "button-variant",
    title: "Variant and tone",
    tags: [],
    stories: [variant],
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
                component: "ButtonGroup",
                controls: [],
            },
        ],
    },
    sizes,
];

const sources = ["packages/ui/src/astro/ui/button.astro"];

// Stories render on the server only, so a pick goes nowhere.
const ignore = () => undefined;

const inspector = {
    mounted: true,
    backdrop: "plain",
    outline: false,
    oncontrols: ignore,
    onstage: ignore,
    onoutline: ignore,
} as const;

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
        id: "bench-compare",
        title: "Bench compare",
        category: "gallery",
        source: "src/gallery/bench-compare.svelte",
        min: "full",
        stories: [
            svelteStory("light-and-dark", BenchCompare, {
                url: storyPath("button-size", "sm"),
                title: "button-size/sm",
                width: 320,
                mode: "schemes",
                onmode: ignore,
            }),
            svelteStory("themes", BenchCompare, {
                url: storyPath("button-size", "sm"),
                title: "button-size/sm",
                width: 320,
                mode: "themes",
                onmode: ignore,
            }),
            svelteStory("off", BenchCompare, {
                url: storyPath("button-size", "sm"),
                title: "button-size/sm",
                width: 320,
                mode: "off",
                onmode: ignore,
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
                current: {
                    group: "button-size",
                    story: "spinning",
                    query: "",
                },
                ...inspector,
            }),
            svelteStory("all-stories", BenchInspector, {
                description: "Buttons, and links that look like them.",
                sources,
                site: false,
                tags: [],
                group: sizes,
                current: { group: "button-size", story: null, query: "" },
                ...inspector,
            }),
            svelteStory("site-only", BenchInspector, {
                sources: ["src/components/blocks/terminal/terminal.astro"],
                site: true,
                tags: ["live"],
                group: sizes,
                current: { group: "button-size", story: "lg", query: "" },
                ...inspector,
            }),
            svelteStory("with-controls", BenchInspector, {
                description: "Buttons, and links that look like them.",
                sources,
                site: false,
                tags: [],
                group: controlled,
                current: {
                    group: "button-variant",
                    story: "default",
                    query: "variant=outline&tone=destructive",
                },
                ...inspector,
                backdrop: "dots",
                outline: true,
            }),
        ],
    },
    {
        id: "bench-controls",
        title: "Bench controls",
        category: "gallery",
        source: "src/gallery/bench-controls.svelte",
        min: 20,
        stories: [
            svelteStory("default", BenchControls, {
                controls: variant.controls,
                values: { variant: "solid", tone: "primary" },
                onchange: ignore,
            }),
            svelteStory("values-set", BenchControls, {
                controls: variant.controls,
                values: { variant: "outline", tone: "destructive" },
                onchange: ignore,
            }),
        ],
    },
    {
        id: "bench-settings",
        title: "Bench settings",
        category: "gallery",
        source: "src/gallery/bench-settings.svelte",
        min: 20,
        stories: [
            svelteStory("default", BenchSettings, {
                stage: "plain",
                outline: false,
                onstage: ignore,
                onoutline: ignore,
            }),
            svelteStory("dots-and-outlines", BenchSettings, {
                stage: "dots",
                outline: true,
                onstage: ignore,
                onoutline: ignore,
            }),
        ],
    },
];
