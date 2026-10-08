import Button from "../../components/ui/button.astro";
import ButtonGroup from "../../components/ui/button-group.astro";
import { TONES } from "../../lib/tone.ts";
import { SIZES, type StoryGroup, story, title } from "../story.ts";

const VARIANTS = ["solid", "outline", "ghost", "link"] as const;

export const buttons: StoryGroup[] = [
    {
        id: "button-matrix",
        title: "Buttons — variant × tone",
        description: "Fill style and colour are independent axes.",
        min: 10,
        stories: VARIANTS.flatMap((variant) =>
            TONES.map((tone) =>
                story(
                    `${variant}-${tone}`,
                    Button,
                    { variant, tone },
                    { icon: "lucide:star", slot: title(tone) },
                ),
            ),
        ),
    },
    {
        id: "button-size",
        title: "Buttons — size and state",
        min: 10,
        stories: [
            ...SIZES.map((size) =>
                story(size, Button, { size }, { slot: title(size) }),
            ),
            story(
                "icon",
                Button,
                { size: "icon", "aria-label": "Favourite" },
                { icon: "lucide:star" },
            ),
            story("disabled", Button, { disabled: true }, { slot: "Disabled" }),
            story(
                "anchor",
                Button,
                { as: "a", href: "#main" },
                { slot: "Anchor" },
            ),
            story("no-lift", Button, { lift: false }, { slot: "No lift" }),
        ],
    },
    {
        id: "button-group",
        title: "Button groups",
        min: 16,
        stories: [
            story(
                "default",
                ButtonGroup,
                { label: "Alignment" },
                {
                    children: ["Left", "Centre", "Right"].map((label) =>
                        story(
                            label.toLowerCase(),
                            Button,
                            { variant: "outline", lift: false },
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
                                lift: false,
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
                        story("one", Button, { lift: false }, { slot: "One" }),
                        story(
                            "two",
                            Button,
                            { lift: false, disabled: true },
                            { slot: "Two" },
                        ),
                        story(
                            "three",
                            Button,
                            { lift: false },
                            { slot: "Three" },
                        ),
                    ],
                },
            ),
        ],
    },
];
