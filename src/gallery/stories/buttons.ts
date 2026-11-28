import Icon from "@cpluspatch/ui/astro/icon.astro";
import Button from "@cpluspatch/ui/astro/ui/button.astro";
import ButtonGroup from "@cpluspatch/ui/astro/ui/button-group.astro";
import { TONES } from "@cpluspatch/ui/lib/tone.ts";
import { SIZES, type StoryGroup, story, title } from "../story.ts";

const VARIANTS = ["solid", "outline", "ghost", "link"] as const;

/** Icon-only members of a group, the first of them pressed. */
const pressedMembers = (variant: "outline" | "ghost") =>
    (
        [
            ["list", "List"],
            ["layout-grid", "Grid"],
            ["columns-2", "Columns"],
        ] as const
    ).map(([icon, label], i) =>
        story(
            icon,
            Button,
            {
                size: "icon",
                variant,
                tone: "neutral",
                "aria-label": label,
                "aria-pressed": i === 0 ? "true" : "false",
            },
            { icon: `lucide:${icon}` },
        ),
    );

export const buttons: StoryGroup[] = [
    {
        id: "button-variant",
        title: "Variant and tone",
        category: "primitives",
        description: "Fill style and color are independent axes.",
        min: 10,
        stories: [
            story(
                "default",
                Button,
                {
                    variant: "solid",
                    tone: "primary",
                    size: "default",
                    disabled: false,
                    busy: false,
                },
                {
                    icon: "lucide:heart",
                    slot: "Button",
                    controls: {
                        variant: { values: VARIANTS, widget: "preview" },
                        tone: { values: TONES, widget: "swatches" },
                        size: { values: SIZES, widget: "sizes" },
                        disabled: "boolean",
                        busy: "boolean",
                        icon: "icon",
                        slot: "text",
                    },
                    port: "button",
                },
            ),
        ],
    },
    {
        id: "button-size",
        title: "Size and state",
        category: "primitives",
        min: 10,
        stories: [
            ...SIZES.map((size) =>
                story(size, Button, { size }, { slot: title(size) }),
            ),
            story(
                "icon",
                Button,
                { size: "icon", "aria-label": "Favorite" },
                { icon: "lucide:star" },
            ),
            story(
                "icon-lg",
                Button,
                { size: "icon-lg", "aria-label": "Favorite" },
                { icon: "lucide:star" },
            ),
            story("disabled", Button, { disabled: true }, { slot: "Disabled" }),
            story(
                "anchor",
                Button,
                { as: "a", href: "#main" },
                { slot: "Anchor" },
            ),
            story(
                "disabled-outline",
                Button,
                { variant: "outline", disabled: true },
                { slot: "Disabled" },
            ),
            story(
                "disabled-ghost",
                Button,
                { variant: "ghost", disabled: true },
                { slot: "Disabled" },
            ),
            story(
                "busy",
                Button,
                { busy: true },
                { slot: "Save changes", tags: ["animated"] },
            ),
            story(
                "busy-icon",
                Button,
                { busy: true },
                {
                    icon: "lucide:check",
                    slot: "Save changes",
                    tags: ["animated"],
                },
            ),
            story(
                "long-label",
                Button,
                {},
                {
                    icon: "lucide:download",
                    slot: "Download the full transcript (PDF, 2.4 MB)",
                },
            ),
            story(
                "icon-end",
                Button,
                {},
                {
                    slot: "Open",
                    children: [
                        story("arrow", Icon, {
                            name: "lucide:external-link",
                            "aria-hidden": "true",
                        }),
                    ],
                },
            ),
            story(
                "link",
                Button,
                { variant: "link" },
                { slot: "Edit profile" },
            ),
        ],
    },
    {
        id: "button-group",
        title: "Groups",
        category: "primitives",
        min: 16,
        stories: [
            story(
                "default",
                ButtonGroup,
                { label: "Alignment" },
                {
                    children: ["Left", "Center", "Right"].map((label) =>
                        story(
                            label.toLowerCase(),
                            Button,
                            { variant: "outline" },
                            { slot: label },
                        ),
                    ),
                },
            ),
            story(
                "icons",
                ButtonGroup,
                { label: "View" },
                {
                    children: ["list", "layout-grid", "columns-2"].map((icon) =>
                        story(
                            icon,
                            Button,
                            {
                                size: "icon",
                                variant: "outline",
                                tone: "neutral",
                                "aria-label": icon,
                            },
                            { icon: `lucide:${icon}` },
                        ),
                    ),
                },
            ),
            story(
                "pressed",
                ButtonGroup,
                { label: "View" },
                {
                    children: pressedMembers("outline"),
                },
            ),
            story(
                "ghost-pressed",
                ButtonGroup,
                { label: "View" },
                {
                    children: pressedMembers("ghost"),
                },
            ),
            story(
                "disabled-member",
                ButtonGroup,
                { label: "Actions" },
                {
                    children: [
                        story("one", Button, {}, { slot: "One" }),
                        story(
                            "two",
                            Button,
                            { disabled: true },
                            { slot: "Two" },
                        ),
                        story("three", Button, {}, { slot: "Three" }),
                    ],
                },
            ),
        ],
    },
];
