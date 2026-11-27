/*
 * What the bench (bench.svelte) is given and how it picks: plain data, so
 * the Astro page can pass it as props, and pure functions on it.
 */

import {
    type Control,
    type ControlValues,
    controlQuery,
    parseControls,
} from "./controls.ts";
import { contentSource, markup } from "./source.ts";
import { storyPath, type Tag } from "./story.ts";

export type BenchStory = {
    name: string;
    /** Its own tags and its group's. */
    tags: Tag[];
    /** As markup, from storySource(). */
    source: string;
    /** The component's display name, as storySource() shows it. */
    component: string;
    /** One per controlled prop, in order; `value` is the story's own. */
    controls: Control[];
    /** The page that renders a controlled story live (playPath). */
    play?: string;
    /** What a controlled story's live source starts from: its props, icon and slot. */
    live?: { props: Record<string, unknown>; icon?: string; slot?: string };
};

export type BenchGroup = {
    id: string;
    title: string;
    tags: Tag[];
    stories: BenchStory[];
};

/**
 * One story, or a group's "All stories" (`story` is null). `query` holds the
 * values of the story's controls that aren't its defaults (controlQuery),
 * and is empty for the story itself.
 */
export type Pick = {
    group: string;
    story: string | null;
    query: string;
};

/** What the stage's stories stand on. */
export type Backdrop = "plain" | "dots" | "surface";

/** What each tag means, for its badge's hint. */
export const TAG_HINTS: Record<Tag, string> = {
    animated: "Moves on its own",
    live: "Shows data fetched when it loads",
};

/**
 * The page a pick shows: a controlled story's live page with its query, any
 * other story's own page, or its group's.
 */
export const pickPath = (
    { group, story, query }: Pick,
    shown?: BenchStory,
): string => {
    if (!story) return `/gallery/story/${group}/`;
    if (shown?.play) return query ? `${shown.play}?${query}` : shown.play;

    return storyPath(group, story);
};

/** A pick's id: `<group>/<story>`, or `<group>` for all of a group's stories. */
export const pickId = ({ group, story }: Pick): string =>
    story ? `${group}/${story}` : group;

/** The URL hash that names a pick: its id, then `?<query>` if it has one. */
export const pickHash = (pick: Pick): string =>
    `#${pickId(pick)}${pick.query && pick.story ? `?${pick.query}` : ""}`;

/** The pick a hash names, or nothing when it isn't one of these groups' own. */
export const parseHash = (
    groups: BenchGroup[],
    hash: string,
): Pick | undefined => {
    const raw = hash.replace(/^#/, "");
    const split = raw.indexOf("?");
    const path = split < 0 ? raw : raw.slice(0, split);
    const search = split < 0 ? "" : raw.slice(split + 1);

    let decoded: string;
    try {
        decoded = decodeURIComponent(path);
    } catch {
        // A malformed hash (`#%`) names nothing, like an unknown one.
        return undefined;
    }

    const [group, story, ...rest] = decoded.split("/");
    const found = groups.find((g) => g.id === group);
    if (!found || rest.length > 0) return undefined;
    if (story === undefined) return { group: found.id, story: null, query: "" };

    const foundStory = found.stories.find((s) => s.name === story);
    if (!foundStory) return undefined;

    // A bad value is dropped, so a stale link still opens the story.
    const query = controlQuery(
        foundStory.controls,
        parseControls(foundStory.controls, search),
    );

    return { group: found.id, story, query };
};

/** A story's control values for a pick's query: the defaults where it sets none. */
export const valuesOf = (story: BenchStory, query: string): ControlValues =>
    parseControls(story.controls, query);

/**
 * A controlled story's markup with the values on it, or its own for any
 * other. The reserved keys `slot` and `icon` are content, not props.
 */
export const liveSource = (
    story: BenchStory,
    values: ControlValues,
): string => {
    const { live } = story;
    if (!live) return story.source;

    const props = { ...live.props };
    for (const { key } of story.controls) {
        if (key === "slot" || key === "icon") continue;
        // A false boolean is the same as the prop left off.
        props[key] = values[key] === false ? undefined : values[key];
    }
    const text = (key: "slot" | "icon") => {
        const value = values[key];
        return typeof value === "string" ? value : live[key];
    };

    return markup(
        story.component,
        props,
        contentSource(text("icon"), text("slot")),
    );
};

/** The first story of the first group, which the stage opens on. */
export const firstPick = (groups: BenchGroup[]): Pick => {
    const [group] = groups;
    if (!group) throw new Error("The bench has no groups");

    return {
        group: group.id,
        story: group.stories[0]?.name ?? null,
        query: "",
    };
};
