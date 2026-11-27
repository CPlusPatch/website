/*
 * The component matrix.
 *
 * stories/ is the single list of every component state worth looking at.
 * /gallery renders it, and lists it at /gallery/manifest.json for anything
 * else that needs the matrix (visual or a11y tests, say).
 *
 * This is simplistic on purpose to avoid the complexity of a full storybook.
 * It does not attempt to express every possible prop combination, only the
 * ones that are likely to be useful to a developer.
 *
 * Composites nest through `children` (the default slot) and `slots` (named
 * slots), each holding more stories -- see the carousel.
 *
 * Groups are sorted into components (components.ts), each of which gets a
 * page at /gallery/<component>/.
 */

import type { ComponentProps } from "astro/types";
import type {
    Component as SvelteComponent,
    ComponentProps as SvelteProps,
} from "svelte";

/** Any `.astro` component. */
// biome-ignore lint/suspicious/noExplicitAny: matches astro's own ComponentProps constraint
type Component = (args: any) => any;

export interface Story {
    /**
     * Unique within its group, and URL-safe (STORY_NAME): it is the last
     * part of the story's own page, and of its `data-story` hook.
     */
    name: string;
    component: Component;
    props: Record<string, unknown>;
    /** Icon rendered before the slot content, for components that take one in a slot. */
    icon?: string;
    /** Slot content, as raw HTML. */
    slot?: string;
    /** Stories rendered in the default slot, after `slot`. */
    children?: Story[];
    /** Stories rendered in named slots. */
    slots?: Record<string, Story[]>;
    /** What sets this story apart for tests (TAGS), on top of its group's. */
    tags?: Tag[];
    /**
     * Props whose values the bench lets a reader set. Each prop in `props`
     * is the default, and every other combination gets a page (combinations()).
     */
    controls?: Record<string, readonly string[]>;
}

/**
 * What tests need to know about a story before they look at it:
 *
 * - `animated`: it keeps moving on its own, past a short CSS entrance,
 *   with nobody touching it, so freeze it (reduced motion) or wait before
 *   comparing pictures of it.
 * - `live`: what it shows comes from elsewhere at runtime and changes
 *   between loads, so don't compare it at all.
 */
export const TAGS = ["animated", "live"] as const;

export type Tag = (typeof TAGS)[number];

/** Sidebar and page sections, in gallery order. */
export const CATEGORIES = [
    { id: "primitives", title: "Primitives", icon: "lucide:shapes" },
    { id: "forms", title: "Forms", icon: "lucide:text-cursor-input" },
    { id: "content", title: "Content", icon: "lucide:pilcrow" },
    { id: "chat", title: "Chat", icon: "lucide:messages-square" },
    {
        id: "showcase",
        title: "Showcase",
        icon: "lucide:gallery-horizontal-end",
    },
    { id: "media", title: "Media", icon: "lucide:clapperboard" },
    { id: "toys", title: "Toys", icon: "lucide:gamepad-2" },
    { id: "sections", title: "Sections", icon: "lucide:panels-top-left" },
    { id: "gallery", title: "Gallery", icon: "lucide:layout-panel-left" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export interface StoryGroup {
    /** Unique. Used for the `data-story` hook and as the group's #anchor. */
    id: string;
    title: string;
    category: CategoryId;
    description?: string;
    /**
     * Minimum gallery cell width, in rem, or "full" for one full-width cell
     * per row. Wider components need more. Defaults to 16.
     */
    min?: number | "full";
    /** Tags (TAGS) every one of its stories has. */
    tags?: Tag[];
    /** The component's file from the repo root, where Astro can't say (a Svelte one). */
    source?: string;
    stories: Story[];
}

/** The values each prop of a component may be set to by a story's `controls`. */
type Controls<P> = {
    [K in keyof P]?: readonly Extract<NonNullable<P[K]>, string>[];
};

type StoryContent<P> = Omit<
    Story,
    "name" | "component" | "props" | "controls"
> & { controls?: Controls<P> };

// The generic Controls<P> can't be shown to fit Story's loose `controls`, so it's cast here.
const build = (
    name: string,
    component: Component,
    props: Record<string, unknown>,
    {
        controls,
        ...content
    }: Omit<Story, "name" | "component" | "props" | "controls"> & {
        controls?: object;
    },
): Story => ({
    name,
    component,
    props,
    ...content,
    ...(controls && { controls: controls as Story["controls"] }),
});

/**
 * Builds a story with its props checked against the component's own Props
 * type -- so a renamed or mistyped prop fails `astro check` rather than
 * silently rendering the default.
 */
export const story = <T extends Component>(
    name: string,
    component: T,
    props: ComponentProps<T>,
    content: StoryContent<ComponentProps<T>> = {},
): Story => build(name, component, props, content);

/**
 * story() for a Svelte component, which Astro renders on the server like
 * its own. It isn't hydrated, so callbacks in its props never run.
 */
// biome-ignore lint/suspicious/noExplicitAny: a component's props are contravariant, so only any fits them all
export const svelteStory = <T extends SvelteComponent<any>>(
    name: string,
    component: T,
    props: SvelteProps<T>,
    content: StoryContent<SvelteProps<T>> = {},
): Story => build(name, component as unknown as Component, props, content);

/** What a story's name may be: lowercase words joined by hyphens. */
export const STORY_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Any text as a story name: "Astrid Yu" becomes "astrid-yu". */
export const slug = (s: string) =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

/** A story's own page, with nothing else on it. */
export const storyPath = (groupId: string, name: string) =>
    `/gallery/story/${groupId}/${name}/`;

/** The most combinations one story's controls may make, its default included. */
export const MAX_COMBINATIONS = 64;

/** A combination of a story's controls, as a story of its own. */
export type Combination = { combo: string; story: Story };

/** A combination's own page, with nothing else on it. */
export const combinationPath = (
    groupId: string,
    name: string,
    combo: string,
): string => `/gallery/story/${groupId}/${name}/${combo}/`;

/**
 * Every combination of a story's controls but the default (its own props),
 * named by the values in control order, the first control changing slowest.
 */
export const combinations = (story: Story): Combination[] => {
    const controls = Object.entries(story.controls ?? {});
    if (controls.length === 0) return [];

    for (const [prop, values] of controls) {
        if (!(prop in story.props)) {
            throw new Error(
                `"${story.name}" controls "${prop}", but its props don't set it`,
            );
        }
        const value = story.props[prop];
        if (typeof value !== "string" || !values.includes(value)) {
            throw new Error(
                `"${story.name}" sets ${prop} to ${JSON.stringify(value)}, which isn't one of its controlled values: ${values.join(", ")}`,
            );
        }
    }

    const count = controls.reduce((n, [, values]) => n * values.length, 1);
    if (count > MAX_COMBINATIONS) {
        throw new Error(
            `"${story.name}" has ${count} combinations, over the most there may be (${MAX_COMBINATIONS})`,
        );
    }

    const picks = controls.reduce<string[][]>(
        (rows, [, values]) =>
            rows.flatMap((row) => values.map((value) => [...row, value])),
        [[]],
    );
    const names = new Set<string>();
    const found: Combination[] = [];
    for (const pick of picks) {
        const combo = pick.join("-");
        if (!STORY_NAME.test(combo) || names.has(combo)) {
            throw new Error(
                `Combination "${combo}" of "${story.name}" is taken or not lowercase-with-hyphens`,
            );
        }
        names.add(combo);

        const props = {
            ...story.props,
            ...Object.fromEntries(controls.map(([prop], i) => [prop, pick[i]])),
        };
        if (controls.every(([prop]) => props[prop] === story.props[prop])) {
            continue;
        }
        found.push({ combo, story: { ...story, props } });
    }

    return found;
};

export const SIZES = ["lg", "default", "sm"] as const;

export const BODY =
    "<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.</p>";

export const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
