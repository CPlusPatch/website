import BlueprintFrame from "@cpluspatch/ui/astro/blocks/blueprint-frame.astro";
import Card from "@cpluspatch/ui/astro/ui/card.astro";
import Terminal from "../../components/blocks/terminal/terminal.astro";
import { BODY, type StoryGroup, story } from "../story.ts";

export const blueprintFrame: StoryGroup[] = [
    {
        id: "blueprint-frame",
        title: "Blueprint frames",
        category: "showcase",
        description:
            "A dashed sheet offset behind any content, which brings its own surface.",
        min: 24,
        stories: [
            story(
                "terminal",
                BlueprintFrame,
                {},
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
                {},
                {
                    children: [
                        story(
                            "card",
                            Card,
                            {},
                            { slot: `<h3>Any content</h3>${BODY}` },
                        ),
                    ],
                },
            ),
        ],
    },
];
