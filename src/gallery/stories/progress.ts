import Progress from "../../components/ui/progress.astro";
import { TONES } from "../../lib/tone.ts";
import { type StoryGroup, story } from "../story.ts";

export const progress: StoryGroup[] = [
    {
        id: "progress",
        title: "Progress",
        category: "primitives",
        source: "ui/progress.astro",
        description:
            "Takes the tone it sits in unless given one. Attachments and carousel pips are built on it.",
        stories: [
            ...[0, 40, 100].map((value) =>
                story(`value-${value}`, Progress, {
                    value,
                    label: "Uploading",
                }),
            ),
            story("max", Progress, {
                value: 3,
                max: 8,
                label: "Step 3 of 8",
            }),
            ...TONES.filter((tone) => tone !== "primary").map((tone) =>
                story(tone, Progress, {
                    value: 60,
                    tone,
                    label: "Uploading",
                }),
            ),
        ],
    },
];
