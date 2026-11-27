import type { APIRoute } from "astro";
import { allStories, sourceOf } from "../../gallery/components.ts";
import { normaliseControls } from "../../gallery/controls.ts";
import { playPath } from "../../gallery/story.ts";

/**
 * Every story with a page of its own, once each and in gallery order, for
 * tests and tools that go through them all (/gallery/manifest.json). A
 * controlled story also has its live page (`play`) and its controls.
 */
export const GET: APIRoute = () =>
    Response.json(
        allStories().map(({ component, group, story, path, tags }) => {
            const controls = normaliseControls(story);

            return {
                id: `${group.id}/${story.name}`,
                component: component.id,
                group: group.id,
                story: story.name,
                path,
                ...(controls.length > 0 && {
                    play: playPath(group.id, story.name),
                    controls,
                }),
                source: sourceOf(group),
                category: group.category,
                min: group.min ?? 16,
                tags,
            };
        }),
    );
