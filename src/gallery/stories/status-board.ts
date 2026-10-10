import type { StatusFeed } from "../../components/blocks/status-board/feed.ts";
import StatusBoard from "../../components/blocks/status-board/status-board.astro";
import { status } from "../../data/status.ts";
import { type StoryGroup, story } from "../story.ts";

// The board without its feed, to show results given to it
const snapshot = { ...status, src: undefined };
const names = status.hosts.flatMap(({ probes }) =>
    probes.map(({ name }) => name),
);

// Those with a response time: not the metrics, nor Nextcloud, which is failing
const probed = new Set(
    names.filter(
        (name) => !["Nextcloud", "PostgreSQL", "Redis"].includes(name),
    ),
);

/** A feed with every probe up, but Nextcloud failing for its last 4. */
const outage: StatusFeed = {
    generatedAt: Date.UTC(2026, 9, 10) / 1000,
    hosts: { faithplate: true, freeman: true, eli: true },
    alerts: 1,
    probes: Object.fromEntries(
        names.map((name, i) => [
            name,
            {
                beats: Array.from(
                    { length: 30 },
                    (_, beat) => name !== "Nextcloud" || beat < 26,
                ),
                latency: probed.has(name) ? 20 + ((i * 13) % 40) : undefined,
            },
        ]),
    ),
};

export const statusBoard: StoryGroup[] = [
    {
        id: "status-board",
        title: "Status board",
        category: "toys",
        source: "blocks/status-board/",
        description:
            "Hosts and the probes run against them, with a timeline of results from a live status feed.",
        min: 30,
        stories: [
            story("live", StatusBoard, status, {
                slot: "Live from Prometheus",
            }),
            story(
                "outage",
                StatusBoard,
                {
                    ...snapshot,
                    label: "Status during an outage",
                    feed: outage,
                },
                { slot: "A snapshot" },
            ),
            story("no results", StatusBoard, snapshot, { slot: "No results" }),
            // At its own height: /status shows the rows sharing a screen
            story(
                "fill",
                StatusBoard,
                { ...status, fill: true },
                { slot: "Live from Prometheus" },
            ),
        ],
    },
];
