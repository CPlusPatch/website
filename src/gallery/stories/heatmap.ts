import Heatmap from "../../components/blocks/heatmap/heatmap.astro";
import { commits } from "../../data/home.ts";
import { type StoryGroup, story } from "../story.ts";

const year = commits.heatmap.values;
// A fixed day, so the labels don't move between builds.
const until = new Date("2026-10-10");

export const heatmap: StoryGroup[] = [
    {
        id: "heatmap",
        title: "Heatmap",
        category: "content",
        source: "blocks/heatmap/",
        description:
            "Levels from 0 to 4 on a grid of any size, optionally as a calendar. Can play the Game of Life on its cells.",
        min: "full",
        stories: [
            story(
                "calendar",
                Heatmap,
                {
                    columns: 52,
                    rows: 7,
                    values: year,
                    until,
                    label: "Commits over the last year",
                },
                { slot: "<span>1,204 contributions in the last year</span>" },
            ),
            story("small, secondary", Heatmap, {
                columns: 20,
                rows: 7,
                // The last 20 weeks of each day's row.
                values: year.filter((_, i) => i % 52 >= 32),
                label: "Commits over the last 20 weeks",
                tone: "secondary",
            }),
            story("life", Heatmap, {
                columns: 52,
                rows: 7,
                values: year,
                until,
                life: true,
                label: "A year of commits, playing the Game of Life",
                tone: "success",
            }),
        ],
    },
];
