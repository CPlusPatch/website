import MediaCard from "../../components/blocks/media-card.astro";
import Card from "../../components/ui/card.astro";
import greg from "../../images/greg.jpg";
import { TONES } from "../../lib/tone.ts";
import { BODY, type StoryGroup, story, title } from "../story.ts";

const MEDIA_LINKS = [
    {
        href: "https://github.com/cpluspatch",
        icon: "lucide:github",
        label: "Source",
    },
    { href: "https://example.com", icon: "lucide:globe", label: "Website" },
    {
        href: "https://example.com/docs",
        icon: "lucide:book-open",
        label: "Docs",
    },
];

export const cards: StoryGroup[] = [
    {
        id: "card",
        title: "Cards",
        category: "primitives",
        source: "ui/card.astro",
        min: 16,
        stories: [
            ...TONES.map((tone) =>
                story(
                    tone,
                    Card,
                    { tone },
                    { slot: `<h3>${title(tone)}</h3>${BODY}` },
                ),
            ),
            story(
                "no-lift",
                Card,
                { lift: false },
                {
                    slot: "<h3>No lift</h3><p>Hover does nothing on this one.</p>",
                },
            ),
        ],
    },
    {
        id: "media-card",
        title: "Media cards",
        category: "blocks",
        source: "blocks/media-card.astro",
        min: 18,
        stories: [
            story(
                "default",
                MediaCard,
                {
                    title: "Diary of a Wimpy Kid",
                    header: { src: greg, alt: "Greg Heffley" },
                    links: MEDIA_LINKS,
                },
                { slot: BODY },
            ),
            story(
                "no-header",
                MediaCard,
                { title: "No header", links: MEDIA_LINKS },
                { slot: BODY },
            ),
            story(
                "no-links",
                MediaCard,
                {
                    title: "No links",
                    header: { src: greg, alt: "Greg Heffley" },
                },
                { slot: BODY },
            ),
            story(
                "secondary",
                MediaCard,
                {
                    title: "Secondary tone",
                    tone: "secondary",
                    links: MEDIA_LINKS,
                },
                { slot: "<p>Tone and lift pass straight through to Card.</p>" },
            ),
        ],
    },
];
