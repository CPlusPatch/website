import Badge from "@cpluspatch/ui/astro/ui/badge.astro";
import Status from "@cpluspatch/ui/astro/ui/status.astro";
import { TONES } from "@cpluspatch/ui/lib/tone.ts";
import { type StoryGroup, story, title } from "../story.ts";

export const status: StoryGroup[] = [
    {
        id: "status",
        title: "Status",
        category: "primitives",
        description:
            "A light takes the text colour unless given a tone. Pulse is off under reduced motion.",
        min: 12,
        stories: [
            story("default", Status, {}, { slot: "Offline" }),
            ...TONES.map((tone) =>
                story(tone, Status, { tone }, { slot: title(tone) }),
            ),
            story(
                "pulse",
                Status,
                { tone: "success", pulse: true },
                { slot: "Live" },
            ),
            story(
                "in-badge",
                Badge,
                { variant: "outline", tone: "success" },
                {
                    children: [
                        story(
                            "status",
                            Status,
                            { pulse: true },
                            { slot: "Available for new projects" },
                        ),
                    ],
                },
            ),
        ],
    },
];
