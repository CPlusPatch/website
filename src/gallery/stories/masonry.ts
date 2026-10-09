import Masonry from "../../components/blocks/masonry.astro";
import Quote from "../../components/blocks/quote.astro";
import { type StoryGroup, story } from "../story.ts";

const QUOTES = [
    "Short.",
    "A quote of middling length, long enough to wrap onto a second line.",
    "A much longer quote, to show items keeping their own height. In a grid, the other items in its row would stretch to match it and leave blank space at the bottom; here they don't.",
    "Another short one.",
    "Items read down each column, then across.",
    "The last one.",
];

export const masonry: StoryGroup[] = [
    {
        id: "masonry",
        title: "Masonry",
        category: "content",
        source: "blocks/masonry.astro",
        description:
            "Columns of uneven items. `min` sets the narrowest column, `columns` the most there are.",
        min: "full",
        stories: [
            story(
                "quotes",
                Masonry,
                {},
                {
                    children: QUOTES.map((text, i) =>
                        story(
                            `quote-${i + 1}`,
                            Quote,
                            { author: { name: `Person ${i + 1}` } },
                            { slot: `<p>${text}</p>` },
                        ),
                    ),
                },
            ),
            story(
                "two-columns",
                Masonry,
                { columns: 2, min: "12rem" },
                {
                    children: QUOTES.slice(0, 4).map((text, i) =>
                        story(
                            `quote-${i + 1}`,
                            Quote,
                            { author: { name: `Person ${i + 1}` } },
                            { slot: `<p>${text}</p>` },
                        ),
                    ),
                },
            ),
        ],
    },
];
