import CardGrid from "../../components/blocks/card-grid.astro";
import Card from "../../components/ui/card.astro";
import { type StoryGroup, story } from "../story.ts";

const cards = (count: number) =>
    Array.from({ length: count }, (_, i) =>
        story(
            `card-${i + 1}`,
            Card,
            {},
            { slot: `<h3>Card ${i + 1}</h3><p>Same size as the rest.</p>` },
        ),
    );

export const cardGrid: StoryGroup[] = [
    {
        id: "card-grid",
        title: "Card grids",
        category: "showcase",
        source: "blocks/card-grid.astro",
        description:
            "One, two, then three columns. A short last row is centred; narrow the preview to see two columns.",
        min: "full",
        stories: [
            story("full-rows", CardGrid, {}, { children: cards(6) }),
            story("two-left-over", CardGrid, {}, { children: cards(8) }),
            story("one-left-over", CardGrid, {}, { children: cards(7) }),
        ],
    },
];
