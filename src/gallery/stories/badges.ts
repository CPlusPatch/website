import Badge from "@cpluspatch/ui/astro/ui/badge.astro";
import { TONES } from "@cpluspatch/ui/lib/tone.ts";
import Badge88x31 from "../../components/blocks/badge-88x31.astro";
import { friends } from "../../data/friends.ts";
import {
    matrix,
    SIZES,
    type StoryGroup,
    slug,
    story,
    title,
} from "../story.ts";

const BADGE_VARIANTS = ["solid", "outline", "ghost"] as const;

export const badges: StoryGroup[] = [
    {
        id: "badge-matrix",
        title: "Variant × tone",
        category: "primitives",
        source: "packages/ui/src/astro/ui/badge.astro",
        description: "Fill style and colour are independent axes.",
        min: 10,
        ...matrix(
            Badge,
            ["variant", BADGE_VARIANTS],
            ["tone", TONES],
            (variant, tone) => [{ variant, tone }, { slot: title(tone) }],
        ),
    },
    {
        id: "badge-size",
        title: "Size",
        category: "primitives",
        source: "packages/ui/src/astro/ui/badge.astro",
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
        source: "src/components/blocks/badge-88x31.astro",
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
