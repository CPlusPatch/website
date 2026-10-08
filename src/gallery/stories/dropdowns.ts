import Dropdown from "../../components/ui/dropdown.astro";
import { type StoryGroup, story } from "../story.ts";

const CONTENT =
    "<p>Any content goes here: settings, links or a short form.</p>";

export const dropdowns: StoryGroup[] = [
    {
        id: "dropdown",
        title: "Dropdowns",
        category: "primitives",
        source: "ui/dropdown.astro",
        description:
            "A native popover: opens, closes on Esc or an outside click, no JS.",
        stories: [
            story(
                "default",
                Dropdown,
                { id: "story-dropdown-default", label: "Options" },
                { slot: CONTENT },
            ),
            story(
                "titled",
                Dropdown,
                {
                    id: "story-dropdown-titled",
                    label: "Settings",
                    icon: "lucide:settings",
                    title: "Settings",
                },
                { slot: CONTENT },
            ),
            story(
                "align-end",
                Dropdown,
                {
                    id: "story-dropdown-end",
                    label: "Aligned to the end",
                    align: "end",
                },
                { slot: CONTENT },
            ),
            story(
                "solid",
                Dropdown,
                {
                    id: "story-dropdown-solid",
                    label: "Solid",
                    variant: "solid",
                    tone: "primary",
                },
                { slot: CONTENT },
            ),
        ],
    },
];
