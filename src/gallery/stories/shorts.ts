import Shorts from "../../components/blocks/shorts/shorts.astro";
// Never the downloaded ones: the gallery is published.
import { samples } from "../../data/shorts.ts";
import { type StoryGroup, story } from "../story.ts";

export const shorts: StoryGroup[] = [
    {
        id: "shorts",
        title: "Shorts",
        category: "media",
        source: "blocks/shorts/",
        description:
            "Without JS, a feed of the browser's own players. Up/Down, K and M work while focus is inside.",
        min: 30,
        stories: [
            story("default", Shorts, { label: "Shorts", videos: samples }),
            story("secondary", Shorts, {
                label: "Shorts, secondary",
                videos: samples.slice(1, 3),
                tone: "secondary",
                style: "--shorts-height: 30rem",
            }),
        ],
    },
];
