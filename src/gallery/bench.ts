/*
 * What the bench (bench.svelte) is given and how it picks: plain data, so
 * the Astro page can pass it as props, and pure functions on it.
 */

import { combinationPath, storyPath, type Tag } from "./story.ts";

export type BenchStory = {
    name: string;
    /** Its own tags and its group's. */
    tags: Tag[];
    /** As markup, from storySource(). */
    source: string;
    /** One per controlled prop, in order; `value` is the story's own. */
    controls: { prop: string; values: string[]; value: string }[];
    /** Each combination by name (see combinations()): its source and control values. */
    combos: Record<string, { source: string; values: Record<string, string> }>;
};

export type BenchGroup = {
    id: string;
    title: string;
    tags: Tag[];
    stories: BenchStory[];
};

/**
 * One story, or a group's "All stories" (`story` is null). `combo` is a
 * combination of the story's controls, and is null for the story itself.
 */
export type Pick = {
    group: string;
    story: string | null;
    combo: string | null;
};

/** What the stage's stories stand on. */
export type Backdrop = "plain" | "dots" | "surface";

/** What each tag means, for its badge's hint. */
export const TAG_HINTS: Record<Tag, string> = {
    animated: "Moves on its own",
    live: "Shows data fetched when it loads",
};

/** The page a pick shows: a story's own page or combination, or its group's. */
export const pickPath = ({ group, story, combo }: Pick): string => {
    if (!story) return `/gallery/story/${group}/`;

    return combo
        ? combinationPath(group, story, combo)
        : storyPath(group, story);
};

/**
 * A pick's id: `<group>/<story>`, with `/<combo>` for a combination, or
 * `<group>` for all of a group's stories.
 */
export const pickId = ({ group, story, combo }: Pick): string => {
    if (!story) return group;

    return combo ? `${group}/${story}/${combo}` : `${group}/${story}`;
};

/** The URL hash that names a pick. */
export const pickHash = (pick: Pick): string => `#${pickId(pick)}`;

/** The pick a hash names, or nothing when it isn't one of these groups' own. */
export const parseHash = (
    groups: BenchGroup[],
    hash: string,
): Pick | undefined => {
    let decoded: string;
    try {
        decoded = decodeURIComponent(hash.replace(/^#/, ""));
    } catch {
        // A malformed hash (`#%`) names nothing, like an unknown one.
        return undefined;
    }

    const [group, story, combo, ...rest] = decoded.split("/");
    const found = groups.find((g) => g.id === group);
    if (!found || rest.length > 0) return undefined;
    if (story === undefined)
        return { group: found.id, story: null, combo: null };

    const foundStory = found.stories.find((s) => s.name === story);
    if (!foundStory) return undefined;
    if (combo === undefined) return { group: found.id, story, combo: null };

    return Object.hasOwn(foundStory.combos, combo)
        ? { group: found.id, story, combo }
        : undefined;
};

/**
 * The combination a set of control values names: null when each is the
 * control's own value, else the values in control order joined by `-`.
 */
export const comboOf = (
    story: BenchStory,
    values: Record<string, string>,
): string | null => {
    const picked = story.controls.map((c) => values[c.prop] ?? c.value);
    if (picked.every((value, i) => value === story.controls[i]?.value)) {
        return null;
    }

    return picked.join("-");
};

/** The first story of the first group, which the stage opens on. */
export const firstPick = (groups: BenchGroup[]): Pick => {
    const [group] = groups;
    if (!group) throw new Error("The bench has no groups");

    return {
        group: group.id,
        story: group.stories[0]?.name ?? null,
        combo: null,
    };
};
