import Figure from "../../components/blocks/figure.astro";
import greg from "../../images/greg.jpg";
import testPattern from "../../images/test-pattern.jpg";
import { type StoryGroup, story } from "../story.ts";

export const figures: StoryGroup[] = [
    {
        id: "figure",
        title: "Figures",
        min: 20,
        stories: [
            story(
                "default",
                Figure,
                { src: testPattern, alt: "A test pattern of colour bars" },
                { slot: "A test pattern, as broadcast between programmes." },
            ),
            story("no-caption", Figure, {
                src: testPattern,
                alt: "A test pattern of colour bars",
            }),
            story(
                "portrait",
                Figure,
                { src: greg, alt: "Greg Heffley", tone: "secondary" },
                {
                    slot: 'Greg Heffley, from <a href="https://example.com">Diary of a Wimpy Kid</a>.',
                },
            ),
            story(
                "cropped",
                Figure,
                {
                    src: testPattern,
                    alt: "A test pattern of colour bars",
                    ratio: "21 / 9",
                },
                {
                    slot: "Cropped to 21 / 9 with <code>ratio</code>. A longer caption wraps under the image without pushing the frame any wider than it is.",
                },
            ),
        ],
    },
];
