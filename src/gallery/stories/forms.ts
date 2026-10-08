import Select from "../../components/ui/select.astro";
import Toggle from "../../components/ui/toggle.astro";
import { type StoryGroup, story } from "../story.ts";

const SELECT_OPTIONS = [
    { value: "one", label: "Option one" },
    { value: "two", label: "Option two" },
    { value: "three", label: "Option three" },
];

export const forms: StoryGroup[] = [
    {
        id: "toggle",
        title: "Toggles",
        min: 10,
        stories: [
            story("default", Toggle, { label: "Example" }),
            story("checked", Toggle, { label: "Example", checked: true }),
            story("disabled", Toggle, { label: "Example", disabled: true }),
            story("checked-disabled", Toggle, {
                label: "Example",
                checked: true,
                disabled: true,
            }),
            story(
                "with-text",
                Toggle,
                { label: "Example" },
                { slot: "Example" },
            ),
        ],
    },
    {
        id: "select",
        title: "Selects",
        min: 10,
        stories: [
            story("default", Select, {
                label: "Example",
                options: SELECT_OPTIONS,
            }),
            story("selected", Select, {
                label: "Example",
                options: SELECT_OPTIONS,
                value: "two",
            }),
            story("disabled", Select, {
                label: "Example",
                options: SELECT_OPTIONS,
                disabled: true,
            }),
        ],
    },
];
