import Badge88x31 from "../../components/blocks/badge-88x31.astro";
import Badge from "../../components/ui/badge.astro";
import { friends } from "../../data/friends.ts";
import { TONES } from "../../lib/tone.ts";
import { SIZES, type StoryGroup, story, title } from "../story.ts";

const BADGE_VARIANTS = ["solid", "outline", "ghost"] as const;

export const badges: StoryGroup[] = [
    {
        id: "badge-matrix",
        title: "Badges — variant × tone",
        category: "primitives",
        source: "ui/badge.astro",
        description: "Fill style and colour are independent axes.",
        min: 10,
        stories: BADGE_VARIANTS.flatMap((variant) =>
            TONES.map((tone) =>
                story(
                    `${variant}-${tone}`,
                    Badge,
                    { variant, tone },
                    { slot: title(tone) },
                ),
            ),
        ),
    },
    {
        id: "badge-size",
        title: "Badges — size",
        category: "primitives",
        source: "ui/badge.astro",
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
        category: "blocks",
        source: "blocks/badge-88x31.astro",
        min: 8,
        stories: [
            ...friends.map((friend) =>
                story(friend.name.toLowerCase(), Badge88x31, {
                    image: friend.image,
                    href: friend.href,
                    alt: `A small icon representing ${friend.name}'s website`,
                }),
            ),
        ],
    },
];
