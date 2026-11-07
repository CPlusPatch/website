/*
 * The gallery's components: its story groups sorted into one page each, at
 * /gallery/<id>/. Most components are a single group; a few gather several
 * (Buttons has its variant × tone table, its sizes and its groups).
 *
 * Checked when the module loads: every group belongs to exactly one
 * component, a component's groups share its category, and every story name
 * can be part of a URL (each story has a page, at storyPath()).
 */

import { groups } from "./stories/index.ts";
import {
    CATEGORIES,
    type CategoryId,
    STORY_NAME,
    type StoryGroup,
} from "./story.ts";

export interface GalleryComponent {
    /** Unique, and the page's path segment. */
    id: string;
    title: string;
    category: CategoryId;
    description?: string;
    groups: StoryGroup[];
}

interface Several {
    id: string;
    title: string;
    description: string;
    /** Group ids, in page order. */
    groups: string[];
}

/** Components of several groups. Every other group is a component of its own. */
const SEVERAL: Several[] = [
    {
        id: "buttons",
        title: "Buttons",
        description:
            "Buttons, and links that look like them. Any variant works with any tone, and a group joins a few into one control.",
        groups: ["button-matrix", "button-size", "button-group"],
    },
    {
        id: "badges",
        title: "Badges",
        description:
            "Small labels, with the same variants and tones as buttons.",
        groups: ["badge-matrix", "badge-size"],
    },
    {
        id: "attachments",
        title: "Attachments",
        description:
            "Files attached to a form or a message, one at a time or in a row.",
        groups: ["attachment", "attachment-vertical", "attachment-group"],
    },
    {
        id: "messages",
        title: "Messages",
        description:
            "Chat messages, from a single bubble up to a run of messages from one sender. One is a dialogue you can click through.",
        groups: [
            "message",
            "message-bubble",
            "message-group",
            "interactive-message",
        ],
    },
    {
        id: "posts",
        title: "Posts",
        description:
            "Microblog posts, as they look in a feed and boxed on their own.",
        groups: ["post", "post-boxed"],
    },
];

/** Path segments the gallery keeps for itself. */
const RESERVED = new Set(["story"]);

const byId = new Map(groups.map((group) => [group.id, group]));
const owner = new Map<string, string>();
for (const component of SEVERAL) {
    for (const id of component.groups) owner.set(id, component.id);
}

/** Every component, in gallery order: by category, then by first group. */
export const components: GalleryComponent[] = CATEGORIES.flatMap((category) => {
    const list: GalleryComponent[] = [];
    for (const group of groups) {
        if (group.category !== category.id) continue;
        const several = SEVERAL.find((c) => c.id === owner.get(group.id));
        if (!several) {
            list.push({
                id: group.id,
                title: group.title,
                category: group.category,
                description: group.description,
                groups: [group],
            });
        } else if (several.groups[0] === group.id) {
            list.push({
                ...several,
                category: group.category,
                groups: several.groups.map((id) => {
                    const member = byId.get(id);
                    if (!member) throw new Error(`No story group "${id}"`);
                    return member;
                }),
            });
        }
    }
    return list;
});

// The checks: unique ids, every group placed once, one category each, and
// story names that are unique in their group and fit in a URL.
for (const group of groups) {
    const names = new Set<string>();
    for (const { name } of group.stories) {
        if (!STORY_NAME.test(name) || names.has(name)) {
            throw new Error(
                `Story name "${name}" in "${group.id}" is taken or not lowercase-with-hyphens`,
            );
        }
        names.add(name);
    }
}

const ids = new Set<string>();
const placed = new Set<string>();
for (const component of components) {
    if (ids.has(component.id) || RESERVED.has(component.id)) {
        throw new Error(`Gallery component id "${component.id}" is taken`);
    }
    ids.add(component.id);
    for (const group of component.groups) {
        if (placed.has(group.id)) {
            throw new Error(`Story group "${group.id}" is in two components`);
        }
        if (group.category !== component.category) {
            throw new Error(
                `Story group "${group.id}" is not in ${component.title}'s category`,
            );
        }
        placed.add(group.id);
    }
}
for (const group of groups) {
    if (!placed.has(group.id)) {
        throw new Error(`Story group "${group.id}" is in no component`);
    }
}

/** The components sorted into categories, in gallery order. */
export const categories = CATEGORIES.map((category) => ({
    ...category,
    components: components.filter((c) => c.category === category.id),
})).filter((category) => category.components.length > 0);

/** The component each group is on, for links to a group. */
export const componentOf = (groupId: string) =>
    components.find((c) => c.groups.some((g) => g.id === groupId));

export const storyCount = (component: GalleryComponent) =>
    component.groups.reduce((n, group) => n + group.stories.length, 0);

/** Where a component's files live: the library, or this site only. */
export const origin = (component: GalleryComponent) =>
    component.groups.every((g) => g.source.startsWith("packages/ui/"))
        ? "packages/ui"
        : "site";
