import Kbd from "../../components/ui/kbd.astro";
import { type StoryGroup, story } from "../story.ts";

export const kbd: StoryGroup[] = [
    {
        id: "kbd",
        title: "Keys",
        category: "primitives",
        source: "ui/kbd.astro",
        description:
            "A key, or a combination in `keys`. Apple devices see ⌥ ⇧ ⌃ ⌘ for the modifiers.",
        min: 10,
        stories: [
            story("single", Kbd, {}, { slot: "K" }),
            story("word", Kbd, {}, { slot: "Esc" }),
            story("combo", Kbd, { keys: ["Ctrl", "K"] }),
            story("three-keys", Kbd, { keys: ["Alt", "Shift", "S"] }),
        ],
    },
];
