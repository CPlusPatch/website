/**
 * The status board's content, on the front page and the status page.
 */
import type { ComponentProps } from "astro/types";
import type StatusBoard from "../components/blocks/status-board/status-board.astro";

/**
 * The status board, with what my infrastructure's Prometheus probes, by
 * host. The names are the feed's, which publishes only these.
 */
export const status: ComponentProps<typeof StatusBoard> = {
    label: "Status of my servers",
    src: "https://static.cpluspatch.com/status.json",
    hosts: [
        {
            name: "faithplate",
            about: "Everything public",
            probes: [
                {
                    name: "Matrix",
                    target: "matrix.cpluspatch.dev",
                },
                {
                    name: "Mail",
                    target: "faithplate.infra.cpluspatch.com:993",
                },
                {
                    name: "Nextcloud",
                    target: "cloud.cpluspatch.com",
                },
                {
                    name: "Immich",
                    target: "photos.cpluspatch.com",
                },
                {
                    name: "Vaultwarden",
                    target: "vault.cpluspatch.com",
                },
                { name: "Sharkey", target: "mk.cpluspatch.com" },
                { name: "Versia", target: "vs.cpluspatch.com" },
            ],
        },
        {
            name: "freeman",
            about: "Databases and monitoring",
            probes: [
                { name: "PostgreSQL", target: "pg_up" },
                { name: "Redis", target: "redis_up" },
            ],
        },
        {
            name: "eli",
            about: "Minecraft",
            probes: [
                {
                    name: "Minecraft",
                    target: "mc.cpluspatch.com:25565",
                },
            ],
        },
    ],
};
