import type { StatusFeed } from "../../components/blocks/status-board/feed.ts";
import StatusBoard from "../../components/blocks/status-board/status-board.astro";
import { status } from "../../data/status.ts";
import { type StoryGroup, story } from "../story.ts";

// The board without its feed, to show results given to it
const snapshot = { ...status, src: undefined };
const names = status.hosts.flatMap(({ probes }) =>
    probes.map(({ name }) => name),
);

// Those with a response time: not the metrics
const metrics = new Set(["PostgreSQL", "Redis"]);

/**
 * A feed from a fixed time, with every probe up but those `failing`, which
 * fail their last `failures` beats.
 */
const feedWith = ({
    failing = [] as string[],
    failures = 4,
    hosts = { faithplate: true, freeman: true, eli: true },
    alerts = 0,
}): StatusFeed => ({
    generatedAt: Date.UTC(2026, 9, 10) / 1000,
    hosts,
    alerts,
    probes: Object.fromEntries(
        names.map((name, i) => [
            name,
            {
                beats: Array.from(
                    { length: 30 },
                    (_, beat) =>
                        !failing.includes(name) || beat < 30 - failures,
                ),
                latency:
                    metrics.has(name) || failing.includes(name)
                        ? undefined
                        : 20 + ((i * 13) % 40),
            },
        ]),
    ),
});

const healthy = feedWith({});
const outage = feedWith({ failing: ["Nextcloud"], alerts: 1 });
const hostDown = feedWith({
    failing: ["Minecraft"],
    failures: 12,
    hosts: { faithplate: true, freeman: true, eli: false },
    alerts: 2,
});

export const statusBoard: StoryGroup[] = [
    {
        id: "status-board",
        title: "Status board",
        category: "toys",
        description:
            "Hosts and the probes run against them, with a timeline of results from a live status feed.",
        min: 30,
        stories: [
            story("live", StatusBoard, status, {
                slot: "Live from Prometheus",
                tags: ["animated", "live"],
            }),
            story(
                "healthy",
                StatusBoard,
                { ...snapshot, label: "Status, all up", feed: healthy },
                { slot: "A snapshot" },
            ),
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
            story(
                "host-down",
                StatusBoard,
                {
                    ...snapshot,
                    label: "Status with a host down",
                    feed: hostDown,
                },
                { slot: "A snapshot" },
            ),
            story("no-results", StatusBoard, snapshot, {
                slot: "No results",
            }),
            // A feed that can't be read, with JS
            story(
                "unavailable",
                StatusBoard,
                { ...status, src: "data:application/json,{" },
                { slot: "Live from Prometheus", tags: ["animated", "live"] },
            ),
            // At its own height: /status shows the rows sharing a screen
            story(
                "fill",
                StatusBoard,
                { ...status, fill: true },
                { slot: "Live from Prometheus", tags: ["animated", "live"] },
            ),
        ],
    },
];
