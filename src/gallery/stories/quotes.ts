import Quote from "../../components/blocks/quote.astro";
import greg from "../../images/greg.jpg";
import { BODY, type StoryGroup, story } from "../story.ts";

export const quotes: StoryGroup[] = [
    {
        id: "quote",
        title: "Quotes",
        min: 24,
        stories: [
            story(
                "default",
                Quote,
                {
                    author: {
                        name: "Greg Heffley",
                        title: "Author of a diary, not a journal",
                        avatar: greg,
                    },
                },
                { slot: "<p>It's not a diary, it's a journal.</p>" },
            ),
            story(
                "no-avatar",
                Quote,
                { author: { name: "Greg Heffley", title: "Middle schooler" } },
                { slot: "<p>A quote with no avatar.</p>" },
            ),
            story(
                "name-only",
                Quote,
                { author: { name: "Greg Heffley" } },
                { slot: "<p>A quote with just a name.</p>" },
            ),
            story(
                "long",
                Quote,
                {
                    author: { name: "Greg Heffley", avatar: greg },
                    cite: "https://example.com",
                },
                { slot: `${BODY}${BODY}` },
            ),
        ],
    },
];
