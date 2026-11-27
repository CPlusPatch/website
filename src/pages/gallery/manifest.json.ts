import type { APIRoute } from "astro";
import { allStories, sourceOf } from "../../gallery/components.ts";

/**
 * Every story and combination of its controls with a page of its own, once
 * each and in gallery order, for
 * tests and tools that go through them all (/gallery/manifest.json).
 */
export const GET: APIRoute = () =>
    Response.json(
        allStories().map(({ component, group, story, combo, path, tags }) => ({
            id: `${group.id}/${story.name}${combo ? `/${combo}` : ""}`,
            component: component.id,
            group: group.id,
            story: story.name,
            combo,
            path,
            source: sourceOf(group),
            category: group.category,
            min: group.min ?? 16,
            tags,
        })),
    );
