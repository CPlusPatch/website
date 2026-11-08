import { readFileSync } from "node:fs";

/** A story as /gallery/manifest.json lists it (src/pages/gallery/manifest.json.ts). */
export interface Story {
    /** `<group>/<story>`: every test about a story is titled with it. */
    id: string;
    component: string;
    group: string;
    story: string;
    path: string;
    source: string;
    category: string;
    min: number | "full";
    tags: ("animated" | "live")[];
}

const MANIFEST = new URL("../../dist/gallery/manifest.json", import.meta.url);

/** Every story, from the last build. */
export const stories: Story[] = (() => {
    try {
        return JSON.parse(readFileSync(MANIFEST, "utf8"));
    } catch {
        throw new Error(
            "No dist/gallery/manifest.json: build first (deno run test:gallery does)",
        );
    }
})();

export const tagged = (story: Story, tag: Story["tags"][number]) =>
    story.tags.includes(tag);

/** A group's page, which shows all of its stories at once. */
export interface Group {
    id: string;
    path: string;
    stories: Story[];
}

/**
 * The stories by group, for checks that spend most of their time waiting:
 * one page load and one wait covers every story in a group.
 */
export const groups: Group[] = [
    ...stories
        .reduce((all, story) => {
            const group = all.get(story.group) ?? {
                id: story.group,
                path: `/gallery/story/${story.group}/`,
                stories: [],
            };
            group.stories.push(story);
            return all.set(story.group, group);
        }, new Map<string, Group>())
        .values(),
];
