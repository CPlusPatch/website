import Input from "../../components/ui/input.astro";
import SegmentedControl from "../../components/ui/segmented-control.astro";
import Select from "../../components/ui/select.astro";
import Textarea from "../../components/ui/textarea.astro";
import Toggle from "../../components/ui/toggle.astro";
import { type StoryGroup, story } from "../story.ts";

const SELECT_OPTIONS = [
    { value: "one", label: "Option one" },
    { value: "two", label: "Option two" },
    { value: "three", label: "Option three" },
];

const VIEW_OPTIONS = [
    { value: "list", label: "List" },
    { value: "grid", label: "Grid" },
    { value: "board", label: "Board" },
];

const ALIGN_OPTIONS = [
    { value: "left", label: "Align left", icon: "lucide:align-left" },
    { value: "center", label: "Align centre", icon: "lucide:align-center" },
    { value: "right", label: "Align right", icon: "lucide:align-right" },
];

export const forms: StoryGroup[] = [
    {
        id: "toggle",
        title: "Toggles",
        category: "forms",
        source: "ui/toggle.astro",
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
        category: "forms",
        source: "ui/select.astro",
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
    {
        id: "input",
        title: "Inputs",
        category: "forms",
        source: "ui/input.astro",
        min: 14,
        stories: [
            story("default", Input, {
                label: "Example",
                placeholder: "Placeholder",
            }),
            story("filled", Input, { label: "Example", value: "Some text" }),
            story("email", Input, {
                label: "Email",
                type: "email",
                placeholder: "you@example.com",
                required: true,
            }),
            story("password", Input, {
                label: "Password",
                type: "password",
                value: "hunter2",
            }),
            story("search", Input, {
                label: "Search",
                type: "search",
                placeholder: "Search…",
            }),
            story("invalid", Input, {
                label: "Example",
                value: "Not quite right",
                "aria-invalid": "true",
            }),
            story("readonly", Input, {
                label: "Example",
                value: "Read only",
                readonly: true,
            }),
            story("disabled", Input, {
                label: "Example",
                placeholder: "Disabled",
                disabled: true,
            }),
        ],
    },
    {
        id: "textarea",
        title: "Textareas",
        category: "forms",
        source: "ui/textarea.astro",
        min: 16,
        stories: [
            story("default", Textarea, {
                label: "Example",
                placeholder: "Write something…",
            }),
            story("filled", Textarea, {
                label: "Example",
                value: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.",
            }),
            story("max-rows", Textarea, {
                label: "Example",
                rows: 2,
                maxRows: 5,
                value: "Grows with its content up to five lines, then scrolls.\nTwo\nThree\nFour\nFive\nSix\nSeven",
            }),
            story("required", Textarea, {
                label: "Example",
                placeholder: "Required, at least 10 characters",
                required: true,
                minlength: 10,
            }),
            story("invalid", Textarea, {
                label: "Example",
                value: "Not quite right",
                "aria-invalid": "true",
            }),
            story("readonly", Textarea, {
                label: "Example",
                value: "Read only",
                readonly: true,
            }),
            story("disabled", Textarea, {
                label: "Example",
                placeholder: "Disabled",
                disabled: true,
            }),
        ],
    },
    {
        id: "segmented-control",
        title: "Segmented controls",
        category: "forms",
        source: "ui/segmented-control.astro",
        description:
            "Plain radios: they submit with a form and can drive CSS via :has().",
        stories: [
            story("text", SegmentedControl, {
                name: "story-segmented-text",
                label: "View",
                options: VIEW_OPTIONS,
                value: "grid",
            }),
            story("icons", SegmentedControl, {
                name: "story-segmented-icons",
                label: "Alignment",
                options: ALIGN_OPTIONS,
                value: "left",
            }),
            story("small", SegmentedControl, {
                name: "story-segmented-small",
                label: "View",
                options: VIEW_OPTIONS,
                value: "list",
                size: "sm",
            }),
            story("disabled", SegmentedControl, {
                name: "story-segmented-disabled",
                label: "View",
                options: VIEW_OPTIONS,
                value: "grid",
                disabled: true,
            }),
        ],
    },
];
