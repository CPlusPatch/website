import ScrollCue from "@cpluspatch/ui/astro/ui/scroll-cue.astro";
import { type StoryGroup, story } from "../story.ts";

export const scrollCue: StoryGroup[] = [
    {
        id: "scroll-cue",
        tags: ["animated"],
        title: "Scroll cues",
        category: "primitives",
        description: "The arrow nudges, except under reduced motion.",
        min: 10,
        stories: [
            story("default", ScrollCue, { href: "#scroll-cue" }),
            story("label", ScrollCue, {
                href: "#scroll-cue",
                label: "More below",
            }),
        ],
    },
];
