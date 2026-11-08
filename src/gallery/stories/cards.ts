import MediaCard from "@cpluspatch/ui/astro/blocks/media-card.astro";
import Card from "@cpluspatch/ui/astro/ui/card.astro";
import { TONES } from "@cpluspatch/ui/lib/tone.ts";
import greg from "../../images/greg.jpg";
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
        min: 16,
        stories: [
            story("default", Card, {}, { slot: `<h3>Default</h3>${BODY}` }),
            ...TONES.map((tone) =>
                story(
                    `rule-${tone}`,
                    Card,
                    { tone, rule: true },
                    { slot: `<h3>${title(tone)} rule</h3>${BODY}` },
                ),
            ),
            story(
                "with-link",
                Card,
                {},
                {
                    slot: `<h3>With a link</h3>${BODY}<a href="https://example.com">Read more</a>`,
                },
            ),
            story(
                "short",
                Card,
                {},
                { slot: "<h3>Short</h3><p>One line.</p>" },
            ),
            story("title-only", Card, {}, { slot: "<h3>Just a title</h3>" }),
            story(
                "long",
                Card,
                { rule: true },
                {
                    slot: `<h3>A considerably longer title that has to wrap onto a second line</h3>${BODY}<p>A second paragraph, to check the rhythm between paragraphs: Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip.</p><a href="https://example.com">Continue reading the whole thing</a>`,
                },
            ),
        ],
    },
    {
        id: "media-card",
        title: "Media cards",
        category: "showcase",
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
                { slot: "<p>Tone passes straight through to Card.</p>" },
            ),
        ],
    },
];
