/*
 * What the bench (bench.svelte) is given and how it picks: plain data, so
 * the Astro page can pass it as props, and pure functions on it.
 */

import { type Axis, storyPath, type Tag } from "./story.ts";

export type BenchStory = {
    name: string;
    /** Its own tags and its group's. */
    tags: Tag[];
    /** As markup, from storySource(). */
    source: string;
};

export type BenchGroup = {
    id: string;
    title: string;
    matrix?: { rows: Axis; columns: Axis };
    tags: Tag[];
    stories: BenchStory[];
};

/** One story, or a group's "All stories" (`story` is null). */
export type Pick = { group: string; story: string | null };

/** What each tag means, for its badge's hint. */
export const TAG_HINTS: Record<Tag, string> = {
    animated: "Moves on its own",
    live: "Shows data fetched when it loads",
};

/** The page a pick shows: a story's own page, or its group's. */
export const pickPath = ({ group, story }: Pick): string =>
    story ? storyPath(group, story) : `/gallery/story/${group}/`;

/** A pick's id: `<group>/<story>`, or `<group>` for all of a group's stories. */
export const pickId = ({ group, story }: Pick): string =>
    story ? `${group}/${story}` : group;

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

    const [group, story, ...rest] = decoded.split("/");
    const found = groups.find((g) => g.id === group);
    if (!found || rest.length > 0) return undefined;
    if (story === undefined) return { group: found.id, story: null };

    return found.stories.some((s) => s.name === story)
        ? { group: found.id, story }
        : undefined;
};

/** The first story of the first group, which the stage opens on. */
export const firstPick = (groups: BenchGroup[]): Pick => {
    const [group] = groups;
    if (!group) throw new Error("The bench has no groups");

    return { group: group.id, story: group.stories[0]?.name ?? null };
};
