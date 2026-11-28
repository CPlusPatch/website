import Button from "@cpluspatch/ui/astro/ui/button.astro";
import ButtonGroup from "@cpluspatch/ui/astro/ui/button-group.astro";
import { TONES } from "@cpluspatch/ui/lib/tone.ts";
import { SIZES, type StoryGroup, story, title } from "../story.ts";

const VARIANTS = ["solid", "outline", "ghost", "link"] as const;

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
                },
                {
                    icon: "lucide:heart",
                    slot: "Button",
                    controls: {
                        variant: { values: VARIANTS, widget: "preview" },
                        tone: { values: TONES, widget: "swatches" },
                        size: { values: SIZES, widget: "sizes" },
                        disabled: "boolean",
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
