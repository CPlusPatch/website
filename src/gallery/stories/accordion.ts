import Accordion from "../../components/blocks/accordion/accordion.astro";
import AccordionItem from "../../components/blocks/accordion/accordion-item.astro";
import { BODY, type StoryGroup, story } from "../story.ts";

const ITEMS = [
    "What is this?",
    "Does it need JavaScript?",
    "A much longer question that wraps onto a second line at narrow widths?",
];

const items = (name?: string) =>
    ITEMS.map((summary, i) =>
        story(
            `item-${i + 1}`,
            AccordionItem,
            { summary, name, open: i === 0 },
            { slot: BODY },
        ),
    );

export const accordion: StoryGroup[] = [
    {
        id: "accordion",
        title: "Accordion",
        category: "blocks",
        source: "blocks/accordion/",
        min: 24,
        stories: [
            story("default", Accordion, {}, { children: items() }),
            story(
                "exclusive",
                Accordion,
                { tone: "secondary" },
                { children: items("exclusive") },
            ),
        ],
    },
];
