import Stat from "../../components/blocks/stat.astro";
import { type StoryGroup, story } from "../story.ts";

export const stats: StoryGroup[] = [
    {
        id: "stat",
        title: "Stats",
        description: "Counts up on first scroll into view, with JS.",
        min: 14,
        stories: [
            story("default", Stat, { value: 12480, label: "Downloads" }),
            story("prefix", Stat, {
                value: 1.2,
                prefix: "$",
                suffix: "M",
                label: "Spent on kebab this year",
                tone: "secondary",
            }),
            story("percent", Stat, {
                value: 99.95,
                suffix: "%",
                label: "Uptime over the last 90 days",
                tone: "success",
            }),
            story("decimals", Stat, {
                value: 4,
                decimals: 1,
                suffix: "/5",
                label: "Average rating, from a long list of reviewers that wraps",
                tone: "warning",
            }),
        ],
    },
];
