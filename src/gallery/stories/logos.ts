import Logos from "../../components/blocks/logos.astro";
import { technologies } from "../../data/technologies.ts";
import { type StoryGroup, story } from "../story.ts";

export const logos: StoryGroup[] = [
    {
        id: "logos",
        title: "Logos",
        category: "showcase",
        source: "blocks/logos.astro",
        min: "full",
        stories: [story("default", Logos, { items: technologies, rows: 5 })],
    },
];
