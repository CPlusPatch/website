import BlueprintFrame from "../../components/blocks/blueprint-frame.astro";
import Terminal from "../../components/blocks/terminal/terminal.astro";
import Card from "../../components/ui/card.astro";
import { BODY, type StoryGroup, story } from "../story.ts";

export const blueprintFrame: StoryGroup[] = [
    {
        id: "blueprint-frame",
        title: "Blueprint frames",
        category: "showcase",
        source: "blocks/blueprint-frame.astro",
        description:
            "Draws around any content, which brings its own surface. The label is optional.",
        min: 24,
        stories: [
            story(
                "terminal",
                BlueprintFrame,
                { label: "fig. 01", meta: "jessew@website" },
                {
                    children: [
                        story("terminal", Terminal, {
                            entries: [{ command: "whoami", output: "jessew" }],
                        }),
                    ],
                },
            ),
            story(
                "card",
                BlueprintFrame,
                { label: "fig. 02" },
                {
                    children: [
                        story(
                            "card",
                            Card,
                            { lift: false },
                            { slot: `<h3>Any content</h3>${BODY}` },
                        ),
                    ],
                },
            ),
            story(
                "no-label",
                BlueprintFrame,
                {},
                {
                    children: [
                        story(
                            "card",
                            Card,
                            { lift: false, tone: "secondary" },
                            { slot: `<h3>No label</h3>${BODY}` },
                        ),
                    ],
                },
            ),
        ],
    },
];
