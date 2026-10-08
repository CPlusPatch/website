import Destructor from "../../components/blocks/destructor.astro";
import { type StoryGroup, story } from "../story.ts";

export const destructor: StoryGroup[] = [
    {
        id: "destructor",
        title: "Destructor",
        category: "blocks",
        source: "blocks/destructor.astro",
        description:
            "Equip the gravity gun, then click anything on the page to pull it out and throw it. Needs a mouse.",
        stories: [story("default", Destructor, {})],
    },
];
