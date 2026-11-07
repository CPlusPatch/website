/*
 * The component matrix.
 *
 * stories/ is the single list of every component state worth looking at.
 * /gallery renders it; keeping it as plain data means anything else that
 * needs the matrix (visual or a11y tests, say) can import it directly.
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
    /** Set by matrix(): the stories are every combination of two axes. */
    matrix?: { rows: Axis; columns: Axis };
    /** Tags (TAGS) every one of its stories has. */
    tags?: Tag[];
    stories: Story[];
}

export interface Axis {
    name: string;
    values: readonly string[];
}

/**
 * Builds a story with its props checked against the component's own Props
 * type -- so a renamed or mistyped prop fails `astro check` rather than
 * silently rendering the default.
 */
export const story = <T extends Component>(
    name: string,
    component: T,
    props: ComponentProps<T>,
    content: StoryContent = {},
): Story => ({ name, component, props, ...content });

type StoryContent = Omit<Story, "name" | "component" | "props">;

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

/**
 * Every combination of two props, as stories named `<row>-<column>` (in
 * row-major order) that the gallery shows as a table. Spread the result into
 * a group. Each combination still goes through story(), so its props are
 * type-checked.
 */
export const matrix = <T extends Component, R extends string, C extends string>(
    component: T,
    [rowName, rows]: [string, readonly R[]],
    [columnName, columns]: [string, readonly C[]],
    build: (row: R, column: C) => [ComponentProps<T>, StoryContent?],
): Pick<StoryGroup, "matrix" | "stories"> => ({
    matrix: {
        rows: { name: rowName, values: rows },
        columns: { name: columnName, values: columns },
    },
    stories: rows.flatMap((row) =>
        columns.map((column) =>
            story(slug(`${row}-${column}`), component, ...build(row, column)),
        ),
    ),
});

export const SIZES = ["lg", "default", "sm"] as const;

export const BODY =
    "<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.</p>";

export const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
