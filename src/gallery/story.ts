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
 */
// deno-lint-ignore-file no-explicit-any

import type { ComponentProps } from "astro/types";

/** Any `.astro` component. */
// biome-ignore lint/suspicious/noExplicitAny: matches astro's own ComponentProps constraint
type Component = (args: any) => any;

export interface Story {
    /** Unique within its group. Used for the `data-story` hook. */
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
}

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
    /** The component's file (or folder, for composites) under src/components/. */
    source: string;
    description?: string;
    /**
     * Minimum gallery cell width, in rem, or "full" for one full-width cell
     * per row. Wider components need more. Defaults to 16.
     */
    min?: number | "full";
    stories: Story[];
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
    content: Omit<Story, "name" | "component" | "props"> = {},
): Story => ({ name, component, props, ...content });

export const SIZES = ["lg", "default", "sm"] as const;

export const BODY =
    "<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.</p>";

export const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
