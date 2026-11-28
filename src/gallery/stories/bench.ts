import type { BenchGroup, BenchStory, Preview } from "../bench.ts";
import BenchAbout from "../bench-about.svelte";
import BenchBar from "../bench-bar.svelte";
import BenchCode from "../bench-code.svelte";
import BenchCompare from "../bench-compare.svelte";
import BenchControl from "../bench-control.svelte";
import BenchControls from "../bench-controls.svelte";
import BenchInspector from "../bench-inspector.svelte";
import BenchList from "../bench-list.svelte";
import BenchProps from "../bench-props.svelte";
import BenchSettings from "../bench-settings.svelte";
import BenchStage from "../bench-stage.svelte";
import BenchTags from "../bench-tags.svelte";
import BenchTiles from "../bench-tiles.svelte";
import type { Control } from "../controls.ts";
import PortView from "../port-view.svelte";
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

// What the Buttons page has: one of each widget.
const buttonsDefault: BenchStory = {
    name: "default",
    tags: [],
    source: '<Button variant="solid" tone="primary" size="default">\n    <Icon name="lucide:heart" />\n    Button\n</Button>',
    component: "Button",
    controls: [
        {
            key: "variant",
            kind: "choice",
            values: ["solid", "outline", "ghost", "link"],
            value: "solid",
            widget: "preview",
        },
        {
            key: "tone",
            kind: "choice",
            values: [
                "primary",
                "secondary",
                "destructive",
                "warning",
                "success",
            ],
            value: "primary",
            widget: "swatches",
        },
        {
            key: "size",
            kind: "choice",
            values: ["lg", "default", "sm"],
            value: "default",
            widget: "sizes",
        },
        { key: "disabled", kind: "boolean", value: false },
        { key: "icon", kind: "icon", value: "lucide:heart" },
        { key: "slot", kind: "text", value: "Button" },
    ],
    play: "/gallery/play/button-variant/default/",
    port: "button",
    live: {
        props: {
            variant: "solid",
            tone: "primary",
            size: "default",
            disabled: false,
        },
        icon: "lucide:heart",
        slot: "Button",
    },
};

// Its props the controls don't reach: `as` and `href`.
const anchor: BenchStory = {
    name: "anchor",
    tags: [],
    source: '<Button as="a" href="#main">Anchor</Button>',
    component: "Button",
    controls: [
        {
            key: "variant",
            kind: "choice",
            values: ["solid", "outline"],
            value: "solid",
        },
        { key: "slot", kind: "text", value: "Anchor" },
    ],
    play: "/gallery/play/button-size/anchor/",
    port: "button",
    live: {
        props: { variant: "solid", as: "a", href: "#main" },
        slot: "Anchor",
    },
};

const widgets: BenchGroup = {
    id: "button-variant",
    title: "Variant and tone",
    tags: [],
    stories: [buttonsDefault, anchor],
};

// What a preview tile draws, with the values on stage.
const buttonPreview: Preview = {
    port: "button",
    props: {
        variant: "solid",
        tone: "primary",
        size: "default",
        disabled: false,
    },
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

const control = (key: string): Control => {
    const found = buttonsDefault.controls.find((c) => c.key === key);
    if (!found) throw new Error(`No "${key}" control`);

    return found;
};

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
                title: "Buttons",
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
                title: "Buttons",
                description: "Buttons, and links that look like them.",
                sources,
                site: false,
                tags: [],
                group: sizes,
                current: { group: "button-size", story: null, query: "" },
                ...inspector,
            }),
            svelteStory("site-only", BenchInspector, {
                title: "Terminal",
                sources: ["src/components/blocks/terminal/terminal.astro"],
                site: true,
                tags: ["live"],
                group: sizes,
                current: { group: "button-size", story: "lg", query: "" },
                ...inspector,
            }),
            svelteStory("with-controls", BenchInspector, {
                title: "Buttons",
                description: "Buttons, and links that look like them.",
                sources,
                site: false,
                tags: [],
                group: widgets,
                current: {
                    group: "button-variant",
                    story: "default",
                    query: "variant=outline&tone=destructive&size=sm",
                },
                ...inspector,
                backdrop: "dots",
                outline: true,
            }),
            svelteStory("fixed-props", BenchInspector, {
                title: "Buttons",
                sources,
                site: false,
                tags: [],
                group: widgets,
                current: {
                    group: "button-variant",
                    story: "anchor",
                    query: "",
                },
                ...inspector,
            }),
        ],
    },
    {
        id: "bench-about",
        title: "Bench about",
        category: "gallery",
        source: "src/gallery/bench-about.svelte",
        min: 20,
        stories: [
            svelteStory("default", BenchAbout, {
                title: "Buttons",
                description: "Buttons, and links that look like them.",
                sources,
                site: false,
                tags: [],
                storyTags: [],
            }),
            svelteStory("site-only-with-tags", BenchAbout, {
                title: "Terminal",
                sources: ["src/components/blocks/terminal/terminal.astro"],
                site: true,
                tags: ["live"],
                storyTags: ["animated"],
            }),
        ],
    },
    {
        id: "bench-tags",
        title: "Bench tags",
        category: "gallery",
        source: "src/gallery/bench-tags.svelte",
        stories: [
            svelteStory("both", BenchTags, { tags: ["animated", "live"] }),
        ],
    },
    {
        id: "bench-props",
        title: "Bench props",
        category: "gallery",
        source: "src/gallery/bench-props.svelte",
        min: 20,
        stories: [
            svelteStory("controls", BenchProps, {
                group: widgets,
                story: buttonsDefault,
                values: { variant: "outline", tone: "success", size: "sm" },
                mounted: true,
                onchange: ignore,
            }),
            svelteStory("fixed-props", BenchProps, {
                group: widgets,
                story: anchor,
                values: { variant: "solid", slot: "Anchor" },
                mounted: true,
                onchange: ignore,
            }),
            svelteStory("no-controls", BenchProps, {
                group: sizes,
                story: sizes.stories[1],
                values: {},
                mounted: true,
                onchange: ignore,
            }),
            svelteStory("all-stories", BenchProps, {
                group: { ...sizes, tags: ["animated"] },
                values: {},
                mounted: true,
                href: `/gallery/story/${sizes.id}/`,
                onchange: ignore,
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
            svelteStory("every-widget", BenchControls, {
                controls: buttonsDefault.controls,
                values: {
                    variant: "ghost",
                    tone: "secondary",
                    size: "lg",
                    disabled: true,
                    icon: "lucide:bookmark",
                    slot: "Save",
                },
                preview: buttonPreview,
                onchange: ignore,
            }),
        ],
    },
    {
        id: "bench-control",
        title: "Bench control",
        category: "gallery",
        source: "src/gallery/bench-control.svelte",
        min: 20,
        stories: [
            svelteStory("segmented", BenchControl, {
                control: variant.controls[0] as Control,
                value: "outline",
                onchange: ignore,
            }),
            svelteStory("select", BenchControl, {
                control: {
                    key: "tone",
                    kind: "choice",
                    values: [
                        "primary",
                        "secondary",
                        "destructive",
                        "warning",
                        "success",
                    ],
                    value: "primary",
                },
                value: "warning",
                onchange: ignore,
            }),
            svelteStory("swatches", BenchControl, {
                control: control("tone"),
                value: "success",
                onchange: ignore,
            }),
            svelteStory("preview", BenchControl, {
                control: control("variant"),
                value: "outline",
                preview: buttonPreview,
                onchange: ignore,
            }),
            svelteStory("sizes", BenchControl, {
                control: control("size"),
                value: "sm",
                onchange: ignore,
            }),
            svelteStory("boolean", BenchControl, {
                control: control("disabled"),
                value: true,
                onchange: ignore,
            }),
            svelteStory("text", BenchControl, {
                control: control("slot"),
                value: "Save",
                onchange: ignore,
            }),
            svelteStory("icon", BenchControl, {
                control: control("icon"),
                value: "lucide:bookmark",
                onchange: ignore,
            }),
        ],
    },
    {
        id: "bench-tiles",
        title: "Bench tiles",
        category: "gallery",
        source: "src/gallery/bench-tiles.svelte",
        min: 20,
        stories: [
            svelteStory("preview", BenchTiles, {
                name: "story-bench-preview",
                label: "variant",
                prop: "variant",
                values: ["solid", "outline", "ghost", "link"],
                value: "outline",
                widget: "preview",
                preview: buttonPreview,
            }),
            svelteStory("sizes", BenchTiles, {
                name: "story-bench-sizes",
                label: "size",
                prop: "size",
                values: ["lg", "default", "sm"],
                value: "default",
                widget: "sizes",
            }),
            svelteStory("many-sizes", BenchTiles, {
                name: "story-bench-many-sizes",
                label: "size",
                prop: "size",
                values: ["xl", "lg", "default", "sm", "xs"],
                value: "sm",
                widget: "sizes",
            }),
        ],
    },
    {
        id: "bench-code",
        title: "Bench code",
        category: "gallery",
        source: "src/gallery/bench-code.svelte",
        min: 20,
        stories: [
            svelteStory("default", BenchCode, {
                source: buttonsDefault.source,
            }),
            svelteStory("long-line", BenchCode, {
                source: '<Button variant="outline" tone="secondary" aria-label="A label long enough to wrap in the column">Save</Button>',
            }),
        ],
    },
    {
        id: "port-view",
        title: "Port view",
        category: "gallery",
        source: "src/gallery/port-view.svelte",
        stories: [
            svelteStory("button", PortView, {
                port: "button",
                props: { variant: "outline", tone: "secondary" },
                icon: "lucide:heart",
                text: "Button",
            }),
            svelteStory("badge", PortView, {
                port: "badge",
                props: { variant: "solid", tone: "success" },
                text: "Badge",
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
