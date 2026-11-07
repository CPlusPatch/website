import Kbd from "@cpluspatch/ui/astro/ui/kbd.astro";
import { type StoryGroup, story } from "../story.ts";

export const kbd: StoryGroup[] = [
    {
        id: "kbd",
        title: "Keys",
        category: "primitives",
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
