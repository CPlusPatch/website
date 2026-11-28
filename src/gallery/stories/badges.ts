import Badge from "@cpluspatch/ui/astro/ui/badge.astro";
import { TONES } from "@cpluspatch/ui/lib/tone.ts";
import Badge88x31 from "../../components/blocks/badge-88x31.astro";
import { friends } from "../../data/friends.ts";
import { SIZES, type StoryGroup, slug, story, title } from "../story.ts";

const BADGE_VARIANTS = ["solid", "outline", "ghost"] as const;

export const badges: StoryGroup[] = [
    {
        id: "badge-variant",
        title: "Variant and tone",
        category: "primitives",
        description: "Fill style and color are independent axes.",
        min: 10,
        stories: [
            story(
                "default",
                Badge,
                { variant: "solid", tone: "primary", size: "default" },
                {
                    slot: "Badge",
                    controls: {
                        variant: {
                            values: BADGE_VARIANTS,
                            widget: "preview",
                        },
                        tone: { values: TONES, widget: "swatches" },
                        size: { values: SIZES, widget: "sizes" },
                        icon: "icon",
                        slot: "text",
                    },
                    port: "badge",
                },
            ),
        ],
    },
    {
        id: "badge-size",
        title: "Size",
        category: "primitives",
        min: 10,
        stories: [
            ...SIZES.map((size) =>
                story(size, Badge, { size }, { slot: title(size) }),
            ),
            ...SIZES.map((size) =>
                story(
                    `icon-${size}`,
                    Badge,
                    { size },
                    { icon: "lucide:badge-check", slot: title(size) },
                ),
            ),
        ],
    },
];

export const badges88x31: StoryGroup[] = [
    {
        id: "88x31",
        title: "88x31s",
        category: "showcase",
        min: 8,
        stories: [
            ...friends.map((friend) =>
                story(slug(friend.name), Badge88x31, {
                    image: friend.image,
                    href: friend.href,
                    alt: `A small icon representing ${friend.name}'s website`,
                }),
            ),
        ],
    },
];
